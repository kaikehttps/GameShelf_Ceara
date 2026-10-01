import { DownloadStatus } from '../generated/prisma/client.js';
import type { TorrentInfo } from './qbittorrent/qbittorrent.types.js';

/** O qBittorrent usa 8640000 s (100 dias) para "sem estimativa". */
export const ETA_INFINITE = 8_640_000;

export interface LiveTorrentState {
  status: DownloadStatus;
  /** Baixando, mas sem conexão com ninguém: "sem peers disponíveis" (não é erro). */
  stalled: boolean;
  /** Concluído e enviando para outros peers (seeding). */
  seeding: boolean;
  /** Erro definitivo reportado pelo cliente. */
  error: string | null;
}

/**
 * Converte o estado do qBittorrent 5.2 (conferido em src/webui/api/serialize/
 * serialize_torrent.cpp) para os estados mostrados no GameShelf.
 * Devolve null para estados desconhecidos: o monitor mantém o status anterior.
 */
export function mapTorrentState(
  torrent: Pick<TorrentInfo, 'state' | 'progress'>,
): LiveTorrentState | null {
  const live = (status: DownloadStatus, extra: Partial<LiveTorrentState> = {}) => ({
    status,
    stalled: false,
    seeding: false,
    error: null,
    ...extra,
  });

  switch (torrent.state) {
    case 'error':
      return live(DownloadStatus.ERROR, {
        error: 'O cliente torrent reportou um erro neste download',
      });
    case 'missingFiles':
      return live(DownloadStatus.ERROR, {
        error: 'Os arquivos do download não estão mais no disco',
      });
    case 'metaDL':
    case 'forcedMetaDL':
      return live(DownloadStatus.METADATA);
    case 'queuedDL':
      return live(DownloadStatus.QUEUED);
    case 'downloading':
    case 'forcedDL':
      return live(DownloadStatus.DOWNLOADING);
    case 'stalledDL':
      return live(DownloadStatus.DOWNLOADING, { stalled: true });
    case 'stoppedDL':
    case 'pausedDL': // nome usado até o qBittorrent 4.x
      return live(DownloadStatus.PAUSED);
    case 'checkingDL':
    case 'checkingUP':
    case 'checkingResumeData':
    case 'moving':
    case 'allocating':
      return live(DownloadStatus.CHECKING);
    case 'uploading':
    case 'forcedUP':
    case 'stalledUP':
    case 'queuedUP':
    case 'stoppedUP':
    case 'pausedUP': {
      // Só é "concluído" com 100%: nunca marcar como concluído por engano.
      if (torrent.progress < 1) {
        return live(DownloadStatus.CHECKING);
      }
      const seeding = torrent.state !== 'stoppedUP' && torrent.state !== 'pausedUP';
      return live(DownloadStatus.COMPLETED, { seeding });
    }
    default:
      return null;
  }
}

/** Segundos restantes, ou null quando não há estimativa honesta ("Calculando…"). */
export function etaSeconds(
  torrent: Pick<TorrentInfo, 'eta' | 'dlspeed'>,
  status: DownloadStatus,
): number | null {
  if (status !== DownloadStatus.DOWNLOADING || torrent.dlspeed <= 0) {
    return null;
  }
  if (torrent.eta < 0 || torrent.eta >= ETA_INFINITE) {
    return null;
  }
  return torrent.eta;
}
