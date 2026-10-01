import type { Prisma } from '../generated/prisma/client.js';

export const downloadSelect = {
  id: true,
  userId: true,
  infoHash: true,
  activeInfoHash: true,
  status: true,
  progress: true,
  downloadedBytes: true,
  totalBytes: true,
  lastError: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  canceledAt: true,
  filesDeletedAt: true,
  source: {
    select: {
      id: true,
      name: true,
      license: true,
      game: { select: { id: true, name: true, coverUrl: true } },
    },
  },
} satisfies Prisma.DownloadSelect;

export type DownloadRecord = Prisma.DownloadGetPayload<{ select: typeof downloadSelect }>;

/** Campos de uma fonte que podem sair na API (o link magnet e o .torrent ficam no servidor). */
export const publicSourceSelect = {
  id: true,
  name: true,
  kind: true,
  sizeBytes: true,
  origin: true,
  license: true,
  authorizationNote: true,
} satisfies Prisma.DownloadSourceSelect;

export type PublicSource = Prisma.DownloadSourceGetPayload<{ select: typeof publicSourceSelect }>;
