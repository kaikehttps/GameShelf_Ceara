/**
 * Campos de `GET /api/v2/torrents/info` usados pelo GameShelf (qBittorrent 5.2, WebAPI
 * 2.15). A lista completa está na wiki oficial "WebUI API (qBittorrent 5.0)".
 */
export interface TorrentInfo {
  hash: string;
  name: string;
  /** Veja `mapTorrentState`. No 5.x, "paused" virou "stopped" (stoppedDL/stoppedUP). */
  state: string;
  /** 0 a 1. */
  progress: number;
  /** Bytes dos arquivos selecionados para download. */
  size: number;
  /** Bytes já baixados e verificados. */
  completed: number;
  dlspeed: number;
  upspeed: number;
  /** Segundos. 8640000 significa "infinito" (sem estimativa). */
  eta: number;
  num_seeds: number;
  num_leechs: number;
  /** Tags separadas por vírgula. */
  tags: string;
  save_path: string;
  /** Unix epoch da conclusão; 0 ou negativo se não concluiu. */
  completion_on: number;
}

export interface AddTorrentOptions {
  magnet?: string;
  torrentFile?: { filename: string; data: Buffer };
  savePath: string;
  tags: string[];
  /** Limite de upload por torrent, em bytes/s. */
  upLimitBytes: number;
  ratioLimit: number;
  seedingTimeLimitMinutes: number;
}
