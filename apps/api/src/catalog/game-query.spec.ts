import { describe, expect, it } from 'vitest';
import {
  buildGameOrderBy,
  buildGameWhere,
  escapeLikePattern,
  GameSort,
  MAX_SEARCH_TERMS,
  SortOrder,
  toSearchTerms,
} from './game-query.js';

describe('toSearchTerms', () => {
  it('separa por espaços, normaliza para minúsculas e remove repetições', () => {
    expect(toSearchTerms('  Hollow   KNIGHT hollow ')).toEqual(['hollow', 'knight']);
  });

  it('retorna lista vazia sem busca', () => {
    expect(toSearchTerms(undefined)).toEqual([]);
    expect(toSearchTerms('')).toEqual([]);
    expect(toSearchTerms('   ')).toEqual([]);
  });

  it('limita a quantidade de palavras', () => {
    expect(toSearchTerms('a b c d e f g')).toHaveLength(MAX_SEARCH_TERMS);
  });
});

describe('escapeLikePattern', () => {
  it('escapa os curingas do LIKE e a própria barra', () => {
    expect(escapeLikePattern('100%')).toBe('100\\%');
    expect(escapeLikePattern('a_b')).toBe('a\\_b');
    expect(escapeLikePattern('c:\\jogos')).toBe('c:\\\\jogos');
  });

  it('não altera texto comum', () => {
    expect(escapeLikePattern("baldur's gate 3")).toBe("baldur's gate 3");
  });
});

describe('buildGameWhere', () => {
  it('sem filtros, não restringe nada', () => {
    expect(buildGameWhere({})).toEqual({ AND: [] });
  });

  it('exige cada palavra no nome e combina gênero e plataforma com E', () => {
    expect(buildGameWhere({ q: 'hollow 100%', genre: 'rpg', platform: 'linux' })).toEqual({
      AND: [
        { name: { contains: 'hollow', mode: 'insensitive' } },
        { name: { contains: '100\\%', mode: 'insensitive' } },
        { genres: { some: { genre: { slug: 'rpg' } } } },
        { platforms: { some: { platform: { slug: 'linux' } } } },
      ],
    });
  });
});

describe('buildGameOrderBy', () => {
  it('usa a direção padrão de cada critério', () => {
    expect(buildGameOrderBy(GameSort.NAME)).toEqual([{ name: 'asc' }, { id: 'asc' }]);
    expect(buildGameOrderBy(GameSort.CREATED_AT)).toEqual([{ createdAt: 'desc' }, { id: 'asc' }]);
  });

  it('deixa datas ausentes no fim nas duas direções', () => {
    for (const order of [SortOrder.ASC, SortOrder.DESC]) {
      expect(buildGameOrderBy(GameSort.RELEASE_DATE, order)).toEqual([
        { releaseDate: { sort: order, nulls: 'last' } },
        { id: 'asc' },
      ]);
    }
  });

  it('desempata a média pela quantidade de avaliações', () => {
    expect(buildGameOrderBy(GameSort.RATING, SortOrder.ASC)).toEqual([
      { ratingAverage: { sort: 'asc', nulls: 'last' } },
      { ratingCount: 'desc' },
      { id: 'asc' },
    ]);
  });
});
