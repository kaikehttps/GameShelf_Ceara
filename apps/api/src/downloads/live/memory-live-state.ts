import { EventEmitter } from 'node:events';
import {
  LiveState,
  type ClientStatus,
  type DownloadEvent,
  type DownloadSnapshot,
} from './live-state.js';

/**
 * Implementação em memória: para uma única instância da API (desenvolvimento local e
 * testes). Com várias instâncias, use Redis (REDIS_URL).
 */
export class MemoryLiveState extends LiveState {
  private readonly snapshots = new Map<string, { snapshot: DownloadSnapshot; expiresAt: number }>();
  private clientStatus: ClientStatus | null = null;
  private readonly emitter = new EventEmitter().setMaxListeners(0);

  saveSnapshots(snapshots: DownloadSnapshot[], ttlMs: number): Promise<void> {
    const expiresAt = Date.now() + ttlMs;
    for (const snapshot of snapshots) {
      this.snapshots.set(snapshot.downloadId, { snapshot, expiresAt });
    }
    return Promise.resolve();
  }

  getSnapshots(downloadIds: string[]): Promise<Map<string, DownloadSnapshot>> {
    const now = Date.now();
    const found = new Map<string, DownloadSnapshot>();
    for (const id of downloadIds) {
      const entry = this.snapshots.get(id);
      if (entry && entry.expiresAt > now) {
        found.set(id, entry.snapshot);
      } else if (entry) {
        this.snapshots.delete(id);
      }
    }
    return Promise.resolve(found);
  }

  saveClientStatus(status: ClientStatus): Promise<void> {
    this.clientStatus = status;
    return Promise.resolve();
  }

  getClientStatus(): Promise<ClientStatus | null> {
    return Promise.resolve(this.clientStatus);
  }

  publish(event: DownloadEvent): Promise<void> {
    this.emitter.emit('event', event);
    return Promise.resolve();
  }

  subscribe(listener: (event: DownloadEvent) => void): () => void {
    this.emitter.on('event', listener);
    return () => this.emitter.off('event', listener);
  }

  tryAcquireMonitorLock(): Promise<boolean> {
    return Promise.resolve(true);
  }

  close(): Promise<void> {
    this.emitter.removeAllListeners();
    return Promise.resolve();
  }
}
