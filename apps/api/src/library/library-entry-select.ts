import { gameSummarySelect } from '../catalog/game-select.js';
import type { Prisma } from '../generated/prisma/client.js';

export const libraryEntrySelect = {
  status: true,
  createdAt: true,
  updatedAt: true,
  game: { select: gameSummarySelect },
} satisfies Prisma.LibraryEntrySelect;

export type LibraryEntryPayload = Prisma.LibraryEntryGetPayload<{
  select: typeof libraryEntrySelect;
}>;
