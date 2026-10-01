import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { DownloadStatus, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DownloadsService } from './downloads.service.js';
import { LiveState, type ClientStatus, type DownloadSnapshot } from './live/live-state.js';
import { QbittorrentClient, TorrentClientError } from './qbittorrent/qbittorrent.client.js';
import type { TorrentInfo } from './qbittorrent/qbittorrent.types.js';
import { etaSeconds, mapTorrentState, type LiveTorrentState } from './torrent-state.js';

/** Quantas vezes a reconciliação tenta enviar ao cliente um download que ficou pendente. */
export const MAX_ADD_ATTEMPTS = 3;
/** Espera antes de reenviar: o pedido original (POST /downloads) ainda pode estar em andamento. */
const PENDING_ADD_GRACE_MS = 15_000;
/** Grava o progresso no banco a cada 10 pontos percentuais (além das mudanças de estado). */
const PROGRESS_CHECKPOINT = 0.1;

const activeDownloadSelect = {
  id: true,
  userId: true,
  infoHash: true,
  status: true,
  progress: true,
  lastError: true,
  addAttempts: true,
  createdAt: true,
  completedAt: true,
  source: { select: { kind: true, reference: true, torrentFile: true } },
} satisfies Prisma.DownloadSelect;

type ActiveDownload = Prisma.DownloadGetPayload<{ select: typeof activeDownloadSelect }>;

/**
 * Um único laço consulta o qBittorrent (e não um por navegador conectado):
 * 1. lista os torrents com a tag do GameShelf (uma chamada);
 * 2. compara com os downloads ativos do banco e grava só MUDANÇAS DE ESTADO (e um
 *    checkpoint de progresso a cada 10%), nunca estatísticas a cada segundo;
 * 3. publica os snapshots (velocidade, ETA...) no LiveState: Redis ou memória;
 * 4. reconcilia: reenvia downloads que não chegaram ao cliente, marca como erro os que
 *    sumiram dele e remove do cliente os torrents órfãos (sem download ativo).
 * Roda na inicialização da API (recuperação após reinício) e depois a cada intervalo.
 */
@Injectable()
export class DownloadMonitorService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(DownloadMonitorService.name);
  private readonly intervalMs: number;
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: QbittorrentClient,
    private readonly downloads: DownloadsService,
    private readonly live: LiveState,
    config: ConfigService<Env, true>,
  ) {
    this.intervalMs = config.get('DOWNLOADS_MONITOR_INTERVAL_MS', { infer: true });
  }

  onApplicationBootstrap(): void {
    if (!this.client.enabled || this.intervalMs === 0) {
      return;
    }
    void this.tick();
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
    // Não segura o processo vivo só por causa do monitor.
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    clearInterval(this.timer);
  }

  /** Uma rodada do monitor. Pública para os testes chamarem sem esperar o intervalo. */
  async tick(): Promise<void> {
    if (!this.client.enabled || this.running) {
      return; // rodada anterior ainda em andamento: não sobrepõe
    }
    this.running = true;
    try {
      // A trava expira sozinha se esta instância cair; outra assume.
      const lockTtl = Math.max(this.intervalMs, 1000) * 3;
      if (!(await this.live.tryAcquireMonitorLock(lockTtl))) {
        return;
      }
      await this.reconcile();
    } catch (error) {
      this.logger.error(`Falha no monitor de downloads: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  private async reconcile(): Promise<void> {
    let torrents: TorrentInfo[];
    try {
      torrents = await this.client.listManaged();
    } catch (error) {
      const message =
        error instanceof TorrentClientError
          ? error.message
          : 'Falha ao consultar o cliente torrent';
      await this.publishClientStatus({ available: false, message });
      return;
    }
    await this.publishClientStatus({ available: true, message: null });

    const byHash = new Map(torrents.map((torrent) => [torrent.hash.toLowerCase(), torrent]));
    const active = await this.prisma.download.findMany({
      where: { activeInfoHash: { not: null } },
      select: activeDownloadSelect,
    });

    const snapshots: DownloadSnapshot[] = [];
    for (const download of active) {
      const torrent = byHash.get(download.infoHash);
      if (!torrent) {
        await this.handleMissing(download);
        continue;
      }
      byHash.delete(download.infoHash);
      const state = mapTorrentState(torrent);
      const status = state
        ? await this.persistIfChanged(download, torrent, state)
        : download.status;
      snapshots.push(toSnapshot(download, torrent, state, status));
    }

    // O que sobrou tem a tag do GameShelf, mas nenhum download ativo: órfão.
    for (const orphan of byHash.values()) {
      this.logger.warn(
        `Removendo do cliente o torrent órfão ${orphan.hash} (arquivos preservados)`,
      );
      await this.client
        .remove(orphan.hash, false)
        .catch((error: Error) =>
          this.logger.warn(`Não foi possível remover o órfão ${orphan.hash}: ${error.message}`),
        );
    }

    await this.live.saveSnapshots(snapshots, Math.max(this.intervalMs, 1000) * 5);
    for (const snapshot of snapshots) {
      await this.live.publish({ type: 'download', snapshot });
    }
  }

  /** Grava no banco só quando o estado muda (ou a cada 10% de progresso). */
  private async persistIfChanged(
    download: ActiveDownload,
    torrent: TorrentInfo,
    state: LiveTorrentState,
  ): Promise<DownloadStatus> {
    const statusChanged = state.status !== download.status || state.error !== download.lastError;
    const checkpoint = torrent.progress - download.progress >= PROGRESS_CHECKPOINT;
    if (!statusChanged && !checkpoint) {
      return download.status;
    }
    const completed = state.status === DownloadStatus.COMPLETED;
    await this.prisma.download.update({
      where: { id: download.id },
      data: {
        status: state.status,
        lastError: state.error,
        // O CHECK do banco exige progresso exatamente 1 em "concluído".
        progress: completed ? 1 : torrent.progress,
        downloadedBytes: BigInt(Math.max(torrent.completed, 0)),
        totalBytes: BigInt(Math.max(torrent.size, 0)),
        completedAt:
          completed && !download.completedAt
            ? torrent.completion_on > 0
              ? new Date(torrent.completion_on * 1000)
              : new Date()
            : undefined,
      },
    });
    if (statusChanged) {
      this.logger.log(`Download ${download.id}: ${download.status} → ${state.status}`);
    }
    return state.status;
  }

  /** Download ativo no banco que não está no cliente. */
  private async handleMissing(download: ActiveDownload): Promise<void> {
    const pending = download.status === DownloadStatus.QUEUED && download.progress === 0;
    if (pending && download.addAttempts < MAX_ADD_ATTEMPTS) {
      if (Date.now() - download.createdAt.getTime() < PENDING_ADD_GRACE_MS) {
        return; // o POST /downloads que criou o registro pode estar enviando agora
      }
      // Ex.: a API caiu entre gravar o download e enviá-lo ao cliente.
      await this.prisma.download.update({
        where: { id: download.id },
        data: { addAttempts: { increment: 1 } },
      });
      try {
        await this.downloads.addToClient(download.id, download.infoHash, download.source);
        this.logger.log(`Download ${download.id} reenviado ao cliente pela reconciliação`);
      } catch (error) {
        await this.prisma.download.update({
          where: { id: download.id },
          data: {
            lastError: `Envio ao cliente torrent falhou: ${(error as Error).message}`.slice(0, 500),
          },
        });
      }
      return;
    }

    const message = pending
      ? 'Não foi possível enviar o download ao cliente torrent'
      : 'A tarefa não existe mais no cliente torrent (foi removida fora do GameShelf?)';
    // Libera o slot do torrent: sem tarefa no cliente, outro download pode começar.
    await this.prisma.download.update({
      where: { id: download.id },
      data: { status: DownloadStatus.ERROR, lastError: message, activeInfoHash: null },
    });
    this.logger.warn(`Download ${download.id}: ${message}`);
  }

  private async publishClientStatus(
    update: Pick<ClientStatus, 'available' | 'message'>,
  ): Promise<void> {
    const previous = await this.live.getClientStatus().catch(() => null);
    const status: ClientStatus = { enabled: true, ...update, checkedAt: new Date().toISOString() };
    await this.live.saveClientStatus(status);
    if (previous?.available !== status.available) {
      if (!status.available) {
        this.logger.warn(`Cliente torrent indisponível: ${status.message}`);
      }
      await this.live.publish({ type: 'client', status });
    }
  }
}

function toSnapshot(
  download: ActiveDownload,
  torrent: TorrentInfo,
  state: LiveTorrentState | null,
  status: DownloadStatus,
): DownloadSnapshot {
  return {
    downloadId: download.id,
    userId: download.userId,
    status,
    progress: status === DownloadStatus.COMPLETED ? 1 : torrent.progress,
    downloadedBytes: Math.max(torrent.completed, 0),
    totalBytes: torrent.size > 0 ? torrent.size : null,
    downloadSpeed: torrent.dlspeed,
    uploadSpeed: torrent.upspeed,
    etaSeconds: etaSeconds(torrent, status),
    peers: torrent.num_seeds + torrent.num_leechs,
    seeds: torrent.num_seeds,
    stalled: state?.stalled ?? false,
    seeding: state?.seeding ?? false,
    lastError: state?.error ?? null,
    updatedAt: new Date().toISOString(),
  };
}
