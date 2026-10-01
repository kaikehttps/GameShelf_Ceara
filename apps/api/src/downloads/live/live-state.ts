import type { DownloadStatus } from '../../generated/prisma/client.js';

/** Estatísticas em tempo real de um download. Transitórias: não vão para o PostgreSQL. */
export interface DownloadSnapshot {
  downloadId: string;
  /** Dono do download: usado para entregar o evento só a ele (não sai na resposta). */
  userId: string;
  status: DownloadStatus;
  progress: number;
  downloadedBytes: number;
  totalBytes: number | null;
  /** bytes/s */
  downloadSpeed: number;
  uploadSpeed: number;
  /** null = sem estimativa ("Calculando…"). */
  etaSeconds: number | null;
  peers: number;
  seeds: number;
  stalled: boolean;
  seeding: boolean;
  lastError: string | null;
  updatedAt: string;
}

export interface ClientStatus {
  enabled: boolean;
  available: boolean;
  message: string | null;
  checkedAt: string | null;
}

export type DownloadEvent =
  { type: 'download'; snapshot: DownloadSnapshot } | { type: 'client'; status: ClientStatus };

/**
 * Estado compartilhado do módulo de downloads. Classe abstrata (e não interface) para
 * servir de token de injeção no Nest.
 */
export abstract class LiveState {
  abstract saveSnapshots(snapshots: DownloadSnapshot[], ttlMs: number): Promise<void>;
  abstract getSnapshots(downloadIds: string[]): Promise<Map<string, DownloadSnapshot>>;
  abstract saveClientStatus(status: ClientStatus): Promise<void>;
  abstract getClientStatus(): Promise<ClientStatus | null>;
  abstract publish(event: DownloadEvent): Promise<void>;
  /** Devolve a função que cancela a inscrição. */
  abstract subscribe(listener: (event: DownloadEvent) => void): () => void;
  /** Só uma instância da API consulta o qBittorrent por vez (as outras só recebem eventos). */
  abstract tryAcquireMonitorLock(ttlMs: number): Promise<boolean>;
  abstract close(): Promise<void>;
}
