import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import {
  LiveState,
  type ClientStatus,
  type DownloadEvent,
  type DownloadSnapshot,
} from './live-state.js';

const PREFIX = 'gameshelf:downloads';
const CHANNEL = `${PREFIX}:events`;
const CLIENT_STATUS_KEY = `${PREFIX}:client-status`;
const MONITOR_LOCK_KEY = `${PREFIX}:monitor-lock`;
const snapshotKey = (downloadId: string) => `${PREFIX}:snapshot:${downloadId}`;
const RENEW_IF_OWNER = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('pexpire', KEYS[1], ARGV[2])
end
return 0`;

/**
 * Implementação com Redis, para várias instâncias da API:
 * - snapshots com expiração (`SET ... PX`): somem sozinhos se o monitor parar;
 * - eventos por pub/sub: o monitor publica uma vez e toda instância repassa aos seus
 *   navegadores conectados (SSE);
 * - trava do monitor (`SET NX PX`): só uma instância consulta o qBittorrent.
 *
 * O pub/sub do Redis exige uma conexão dedicada para assinar, por isso há duas.
 */
export class RedisLiveState extends LiveState {
  private readonly logger = new Logger(RedisLiveState.name);
  private readonly instanceId = randomUUID();
  private readonly commands: Redis;
  private readonly subscriber: Redis;
  private readonly listeners = new Set<(event: DownloadEvent) => void>();

  constructor(url: string) {
    super();
    // Sem fila offline: com o Redis fora, os comandos falham logo em vez de esperar para sempre.
    const options = { maxRetriesPerRequest: 2, enableOfflineQueue: false, lazyConnect: false };
    this.commands = new Redis(url, options);
    this.subscriber = new Redis(url, { ...options, enableOfflineQueue: true });
    this.commands.on('error', (error: Error) => this.logger.warn(`Redis: ${error.message}`));
    this.subscriber.on('error', (error: Error) =>
      this.logger.warn(`Redis (pub/sub): ${error.message}`),
    );
    this.subscriber.on('message', (_channel: string, message: string) => {
      const event = JSON.parse(message) as DownloadEvent;
      this.listeners.forEach((listener) => listener(event));
    });
    void this.subscriber
      .subscribe(CHANNEL)
      .catch((error: Error) =>
        this.logger.warn(`Não foi possível assinar ${CHANNEL}: ${error.message}`),
      );
  }

  async saveSnapshots(snapshots: DownloadSnapshot[], ttlMs: number): Promise<void> {
    if (snapshots.length === 0) {
      return;
    }
    const pipeline = this.commands.multi();
    for (const snapshot of snapshots) {
      pipeline.set(snapshotKey(snapshot.downloadId), JSON.stringify(snapshot), 'PX', ttlMs);
    }
    await pipeline.exec();
  }

  async getSnapshots(downloadIds: string[]): Promise<Map<string, DownloadSnapshot>> {
    const found = new Map<string, DownloadSnapshot>();
    if (downloadIds.length === 0) {
      return found;
    }
    const values = await this.commands.mget(downloadIds.map(snapshotKey));
    values.forEach((value, index) => {
      if (value) {
        found.set(downloadIds[index], JSON.parse(value) as DownloadSnapshot);
      }
    });
    return found;
  }

  async saveClientStatus(status: ClientStatus): Promise<void> {
    await this.commands.set(CLIENT_STATUS_KEY, JSON.stringify(status));
  }

  async getClientStatus(): Promise<ClientStatus | null> {
    const value = await this.commands.get(CLIENT_STATUS_KEY);
    return value ? (JSON.parse(value) as ClientStatus) : null;
  }

  async publish(event: DownloadEvent): Promise<void> {
    await this.commands.publish(CHANNEL, JSON.stringify(event));
  }

  subscribe(listener: (event: DownloadEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Pega a trava, ou renova se ela já é desta instância. */
  async tryAcquireMonitorLock(ttlMs: number): Promise<boolean> {
    const acquired = await this.commands.set(MONITOR_LOCK_KEY, this.instanceId, 'PX', ttlMs, 'NX');
    if (acquired === 'OK') {
      return true;
    }
    // "Se a trava é minha, renova" num passo só (atômico): entre um GET e um PEXPIRE
    // separados, a trava poderia expirar e passar para outra instância.
    const renewed = await this.commands.eval(
      RENEW_IF_OWNER,
      1,
      MONITOR_LOCK_KEY,
      this.instanceId,
      ttlMs,
    );
    return renewed === 1;
  }

  async close(): Promise<void> {
    this.listeners.clear();
    await Promise.allSettled([this.commands.quit(), this.subscriber.quit()]);
  }
}
