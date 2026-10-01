import type { Prisma } from '../generated/prisma/client.js';

/**
 * Colunas lidas do banco para montar as respostas do catálogo. Como em `publicUserSelect`,
 * a seleção explícita evita que uma coluna interna (ex.: `ratingSum`) vaze por acidente.
 */
const taxonomySelect = { slug: true, name: true } satisfies Prisma.GenreSelect;

export const gameSummarySelect = {
  id: true,
  name: true,
  coverUrl: true,
  bannerUrl: true,
  releaseDate: true,
  ratingAverage: true,
  ratingCount: true,
  // Só o provedor: basta para o selo da loja nos cards.
  externalIds: { select: { provider: true }, orderBy: { provider: 'asc' } },
  genres: { select: { genre: { select: taxonomySelect } }, orderBy: { genre: { name: 'asc' } } },
  platforms: {
    select: { platform: { select: taxonomySelect } },
    orderBy: { platform: { name: 'asc' } },
  },
} satisfies Prisma.GameSelect;

export const gameDetailSelect = {
  ...gameSummarySelect,
  description: true,
  updatedAt: true,
  externalIds: { select: { provider: true, externalId: true }, orderBy: { provider: 'asc' } },
} satisfies Prisma.GameSelect;

export type GameSummary = Prisma.GameGetPayload<{ select: typeof gameSummarySelect }>;
export type GameDetail = Prisma.GameGetPayload<{ select: typeof gameDetailSelect }>;
