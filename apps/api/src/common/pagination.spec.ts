import { describe, expect, it } from 'vitest';
import { pageArgs, toPage } from './pagination.js';

describe('paginação', () => {
  it('converte página e tamanho em skip/take', () => {
    expect(pageArgs({ page: 1, pageSize: 20 })).toEqual({ skip: 0, take: 20 });
    expect(pageArgs({ page: 3, pageSize: 10 })).toEqual({ skip: 20, take: 10 });
  });

  it('calcula o total de páginas, arredondando para cima', () => {
    expect(toPage(['a'], 21, { page: 2, pageSize: 10 })).toEqual({
      items: ['a'],
      page: 2,
      pageSize: 10,
      total: 21,
      totalPages: 3,
    });
    expect(toPage([], 0, { page: 1, pageSize: 10 }).totalPages).toBe(0);
  });
});
