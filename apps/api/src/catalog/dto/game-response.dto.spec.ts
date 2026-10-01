import { describe, expect, it } from 'vitest';
import { Prisma } from '../../generated/prisma/client.js';
import type { GameDetail } from '../game-select.js';
import { storeUrlFor, toGameDetail, toGameSummary } from './game-response.dto.js';

const game: GameDetail = {
  id: '0199a0b2-7f3c-7a1e-9c4d-1234567890ab',
  name: 'Hollow Knight',
  coverUrl: 'https://example.com/capa.jpg',
  bannerUrl: 'https://example.com/banner.jpg',
  releaseDate: new Date('2017-02-24T00:00:00.000Z'),
  ratingAverage: new Prisma.Decimal('4.33'),
  ratingCount: 3,
  genres: [{ genre: { slug: 'acao', name: 'Ação' } }],
  platforms: [{ platform: { slug: 'linux', name: 'Linux' } }],
  description: 'Metroidvania.',
  updatedAt: new Date('2026-10-01T12:00:00.000Z'),
  externalIds: [{ provider: 'STEAM', externalId: '367520' }],
};

describe('mapeamento de jogos para a resposta', () => {
  it('converte data para AAAA-MM-DD e a média DECIMAL para número', () => {
    expect(toGameSummary(game)).toEqual({
      id: game.id,
      name: 'Hollow Knight',
      coverUrl: 'https://example.com/capa.jpg',
      bannerUrl: 'https://example.com/banner.jpg',
      stores: ['STEAM'],
      releaseDate: '2017-02-24',
      genres: [{ slug: 'acao', name: 'Ação' }],
      platforms: [{ slug: 'linux', name: 'Linux' }],
      rating: { average: 4.33, count: 3 },
    });
  });

  it('mantém null quando não há data nem avaliações', () => {
    const summary = toGameSummary({
      ...game,
      releaseDate: null,
      ratingAverage: null,
      ratingCount: 0,
    });

    expect(summary.releaseDate).toBeNull();
    expect(summary.rating).toEqual({ average: null, count: 0 });
  });

  it('inclui descrição e identificadores externos nos detalhes', () => {
    expect(toGameDetail(game)).toMatchObject({
      description: 'Metroidvania.',
      externalIds: [
        {
          provider: 'STEAM',
          externalId: '367520',
          storeUrl: 'https://store.steampowered.com/app/367520',
        },
      ],
      updatedAt: game.updatedAt,
    });
  });

  it('só monta link de loja quando o formato da URL é conhecido', () => {
    expect(storeUrlFor('STEAM', '620')).toBe('https://store.steampowered.com/app/620');
    expect(storeUrlFor('EPIC', 'qualquer')).toBeNull();
    expect(storeUrlFor('LAUNCHBOX', '12345')).toBeNull();
  });
});
