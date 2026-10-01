import type { Prisma } from '../generated/prisma/client.js';

export enum GameSort {
  NAME = 'name',
  RELEASE_DATE = 'releaseDate',
  RATING = 'rating',
  CREATED_AT = 'createdAt',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

/** Sem `order` informado: nome de A a Z; datas e notas do maior para o menor. */
export const DEFAULT_SORT_ORDER: Record<GameSort, SortOrder> = {
  [GameSort.NAME]: SortOrder.ASC,
  [GameSort.RELEASE_DATE]: SortOrder.DESC,
  [GameSort.RATING]: SortOrder.DESC,
  [GameSort.CREATED_AT]: SortOrder.DESC,
};

export const SEARCH_MAX_LENGTH = 100;
export const MAX_SEARCH_TERMS = 5;

export interface GameFilters {
  q?: string;
  genre?: string;
  platform?: string;
}

/**
 * Quebra a busca em palavras: "witcher wild" encontra "The Witcher 3: Wild Hunt".
 * Palavras repetidas são descartadas e o total é limitado, para a consulta não crescer
 * sem controle.
 */
export function toSearchTerms(q: string | undefined): string[] {
  if (!q) {
    return [];
  }
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return [...new Set(words)].slice(0, MAX_SEARCH_TERMS);
}

/**
 * O `contains` do Prisma vira `ILIKE '%' || termo || '%'` sem escapar os curingas do LIKE:
 * buscar "%" retornaria o catálogo inteiro. Escapamos `\`, `%` e `_` (a barra é o
 * caractere de escape padrão do LIKE no PostgreSQL).
 */
export function escapeLikePattern(term: string): string {
  return term.replace(/[\\%_]/g, '\\$&');
}

/**
 * Cada palavra precisa aparecer no nome, em qualquer posição e sem diferenciar
 * maiúsculas (índice de trigramas `games_name_trgm_idx`). Gênero e plataforma
 * filtram pelo slug. Todas as condições se combinam com E.
 */
export function buildGameWhere({ q, genre, platform }: GameFilters): Prisma.GameWhereInput {
  const conditions: Prisma.GameWhereInput[] = toSearchTerms(q).map((term) => ({
    name: { contains: escapeLikePattern(term), mode: 'insensitive' },
  }));
  if (genre) {
    conditions.push({ genres: { some: { genre: { slug: genre } } } });
  }
  if (platform) {
    conditions.push({ platforms: { some: { platform: { slug: platform } } } });
  }
  return { AND: conditions };
}

/**
 * Ordenação sempre determinística: o `id` desempata registros com o mesmo valor, senão
 * um jogo poderia aparecer em duas páginas (ou em nenhuma). Campos opcionais (data,
 * média) deixam os nulos no fim nas duas direções.
 */
export function buildGameOrderBy(
  sort: GameSort,
  order: SortOrder = DEFAULT_SORT_ORDER[sort],
): Prisma.GameOrderByWithRelationInput[] {
  const tieBreaker: Prisma.GameOrderByWithRelationInput = { id: 'asc' };
  switch (sort) {
    case GameSort.NAME:
      return [{ name: order }, tieBreaker];
    case GameSort.RELEASE_DATE:
      return [{ releaseDate: { sort: order, nulls: 'last' } }, tieBreaker];
    case GameSort.RATING:
      // Mesma média: quem tem mais avaliações vem primeiro.
      return [
        { ratingAverage: { sort: order, nulls: 'last' } },
        { ratingCount: 'desc' },
        tieBreaker,
      ];
    case GameSort.CREATED_AT:
      return [{ createdAt: order }, tieBreaker];
  }
}
