import { describe, expect, it } from 'vitest';
import {
  formatRating,
  formatReleaseDate,
  genresLabel,
  initials,
  plural,
  safeNextPath,
  starFill,
  storesLabel,
} from './format';

describe('formatação', () => {
  it('mostra a média com uma casa e vírgula', () => {
    expect(formatRating(4.33)).toBe('4,3');
    expect(formatRating(5)).toBe('5,0');
  });

  it('formata a data de lançamento sem cair no dia anterior por causa do fuso', () => {
    expect(formatReleaseDate('2017-02-24')).toBe('24/02/2017');
  });

  it('pluraliza contagens', () => {
    expect(plural(1, 'jogo', 'jogos')).toBe('1 jogo');
    expect(plural(1200, 'jogo', 'jogos')).toBe('1.200 jogos');
  });

  it('resume gêneros e lojas', () => {
    const genres = [
      { slug: 'acao', name: 'Ação' },
      { slug: 'indie', name: 'Indie' },
      { slug: 'rpg', name: 'RPG' },
    ];
    expect(genresLabel(genres)).toBe('Ação / Indie');
    expect(storesLabel(['STEAM', 'EPIC'])).toBe('Steam / Epic Games');
  });

  it('gera iniciais do nome de exibição', () => {
    expect(initials('Conta Demo')).toBe('CD');
    expect(initials('  kaike ')).toBe('K');
    expect(initials('Ana Maria Souza')).toBe('AS');
  });

  it('só aceita caminhos internos no ?next= (sem redirecionar para outro site)', () => {
    expect(safeNextPath('/biblioteca')).toBe('/biblioteca');
    expect(safeNextPath('//evil.example')).toBe('/');
    expect(safeNextPath('https://evil.example')).toBe('/');
    expect(safeNextPath(null)).toBe('/');
  });

  it('arredonda a nota para meia estrela', () => {
    expect([1, 2, 3, 4, 5].map((star) => starFill(4.5, star))).toEqual([
      'full',
      'full',
      'full',
      'full',
      'half',
    ]);
    expect(starFill(4.33, 5)).toBe('half');
    expect(starFill(4.2, 5)).toBe('empty');
  });
});
