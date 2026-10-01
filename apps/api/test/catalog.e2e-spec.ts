import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  createAccount,
  createGame,
  createTestApp,
  resetDatabase,
  type GameFixture,
} from './helpers.js';

const GAMES: GameFixture[] = [
  {
    name: 'Hollow Knight',
    description: 'Metroidvania em 2D.',
    coverUrl: 'https://example.com/hollow-knight.jpg',
    releaseDate: '2017-02-24',
    genres: ['acao', 'aventura'],
    platforms: ['windows', 'linux'],
    steamAppId: '367520',
  },
  {
    name: 'Hollow Knight: Silksong',
    releaseDate: '2025-09-04',
    genres: ['acao', 'aventura'],
    platforms: ['windows', 'linux'],
  },
  {
    name: 'Celeste',
    releaseDate: '2018-01-25',
    genres: ['acao'],
    platforms: ['windows', 'linux', 'macos'],
  },
  {
    name: 'Stardew Valley',
    releaseDate: '2016-02-26',
    genres: ['rpg', 'simulacao'],
    platforms: ['windows', 'macos'],
  },
  {
    name: "Baldur's Gate 3",
    releaseDate: '2023-08-03',
    genres: ['rpg', 'estrategia'],
    platforms: ['windows', 'macos'],
  },
  { name: '100% Orange Juice', releaseDate: '2014-05-30', genres: ['estrategia'] },
  { name: 'Jogo Sem Data', genres: ['rpg'], platforms: ['windows'] },
];

describe('Catálogo (e2e)', () => {
  let app: INestApplication;
  const ids: Record<string, string> = {};

  // Só leitura: os dados são criados uma vez para todos os testes do arquivo.
  beforeAll(async () => {
    app = await createTestApp();
    const prisma = app.get(PrismaService);
    await resetDatabase(app);

    for (const [index, game] of GAMES.entries()) {
      ids[game.name] = await createGame(app, game);
      // Datas de inclusão distintas e conhecidas, para a ordenação por createdAt.
      await prisma.game.update({
        where: { id: ids[game.name] },
        data: { createdAt: new Date(Date.UTC(2026, 0, index + 1)) },
      });
    }

    const [ana, bruno] = [await createAccount(app, 'Ana'), await createAccount(app, 'Bruno')];
    const reviews = [
      { userId: ana.id, gameId: ids['Celeste'], rating: 5 },
      { userId: bruno.id, gameId: ids['Celeste'], rating: 5 },
      { userId: ana.id, gameId: ids['Hollow Knight'], rating: 5 },
      { userId: ana.id, gameId: ids['Stardew Valley'], rating: 4 },
      { userId: bruno.id, gameId: ids['Stardew Valley'], rating: 3 },
      { userId: ana.id, gameId: ids["Baldur's Gate 3"], rating: 4 },
    ];
    for (const data of reviews) {
      await prisma.review.create({ data });
    }
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const names = (res: request.Response) =>
    (res.body.items as { name: string }[]).map((game) => game.name);

  describe('listagem e paginação', () => {
    it('lista sem autenticação, em ordem alfabética, com os metadados da página', async () => {
      const res = await http().get('/games?pageSize=3').expect(200);

      expect(res.body).toMatchObject({ page: 1, pageSize: 3, total: 7, totalPages: 3 });
      expect(names(res)).toEqual(['100% Orange Juice', "Baldur's Gate 3", 'Celeste']);
    });

    it('navega pelas páginas sem repetir nem pular jogos', async () => {
      const pages = await Promise.all(
        [1, 2, 3, 4].map((page) => http().get(`/games?pageSize=3&page=${page}`).expect(200)),
      );

      expect(pages.map(names)).toEqual([
        ['100% Orange Juice', "Baldur's Gate 3", 'Celeste'],
        ['Hollow Knight', 'Hollow Knight: Silksong', 'Jogo Sem Data'],
        ['Stardew Valley'],
        [],
      ]);
      expect(pages[3].body.total).toBe(7);
    });

    it('usa 20 itens por página por padrão', async () => {
      const res = await http().get('/games').expect(200);

      expect(res.body.pageSize).toBe(20);
      expect(res.body.items).toHaveLength(7);
    });

    it('recusa paginação e ordenação inválidas em vez de corrigi-las em silêncio', async () => {
      const invalid = [
        'pageSize=51',
        'pageSize=0',
        'page=0',
        'page=1001',
        'page=abc',
        'page=1.5',
        'sort=preco',
        'order=up',
        'desconhecido=1',
      ];
      for (const query of invalid) {
        await http().get(`/games?${query}`).expect(400);
      }
    });
  });

  describe('busca e filtros', () => {
    it('busca palavras do nome sem diferenciar maiúsculas e em qualquer ordem', async () => {
      expect(names(await http().get('/games?q=hollow').expect(200))).toEqual([
        'Hollow Knight',
        'Hollow Knight: Silksong',
      ]);
      expect(names(await http().get('/games?q=KNIGHT%20hollow').expect(200))).toHaveLength(2);
      expect(names(await http().get('/games?q=silksong%20HOLLOW').expect(200))).toEqual([
        'Hollow Knight: Silksong',
      ]);
      expect((await http().get('/games?q=inexistente').expect(200)).body.total).toBe(0);
    });

    it('trata % e _ como texto, não como curingas do LIKE', async () => {
      expect(names(await http().get('/games?q=%25').expect(200))).toEqual(['100% Orange Juice']);
      expect((await http().get('/games?q=_').expect(200)).body.total).toBe(0);
    });

    it('recusa busca longa demais', async () => {
      await http()
        .get(`/games?q=${'a'.repeat(101)}`)
        .expect(400);
    });

    it('filtra por gênero e por plataforma, combinando com a busca', async () => {
      expect(names(await http().get('/games?genre=rpg').expect(200))).toEqual([
        "Baldur's Gate 3",
        'Jogo Sem Data',
        'Stardew Valley',
      ]);
      expect(names(await http().get('/games?platform=MACOS').expect(200))).toEqual([
        "Baldur's Gate 3",
        'Celeste',
        'Stardew Valley',
      ]);
      expect(names(await http().get('/games?genre=rpg&platform=macos').expect(200))).toEqual([
        "Baldur's Gate 3",
        'Stardew Valley',
      ]);
      expect(names(await http().get('/games?genre=acao&q=silksong').expect(200))).toEqual([
        'Hollow Knight: Silksong',
      ]);
      expect((await http().get('/games?genre=inexistente').expect(200)).body.total).toBe(0);
    });

    it('recusa filtro que não é slug', async () => {
      await http().get('/games?genre=n%C3%A3o%20slug').expect(400);
      await http().get('/games?genre=rpg&genre=acao').expect(400);
    });
  });

  describe('ordenação', () => {
    it('ordena por lançamento, com jogos sem data sempre no fim', async () => {
      expect(names(await http().get('/games?sort=releaseDate').expect(200))).toEqual([
        'Hollow Knight: Silksong',
        "Baldur's Gate 3",
        'Celeste',
        'Hollow Knight',
        'Stardew Valley',
        '100% Orange Juice',
        'Jogo Sem Data',
      ]);
      expect(names(await http().get('/games?sort=releaseDate&order=asc').expect(200))).toEqual([
        '100% Orange Juice',
        'Stardew Valley',
        'Hollow Knight',
        'Celeste',
        "Baldur's Gate 3",
        'Hollow Knight: Silksong',
        'Jogo Sem Data',
      ]);
    });

    it('ordena pela média, desempatando pela quantidade de avaliações', async () => {
      const desc = await http().get('/games?sort=rating').expect(200);
      expect(names(desc).slice(0, 4)).toEqual([
        'Celeste', // 5,00 com 2 avaliações
        'Hollow Knight', // 5,00 com 1 avaliação
        "Baldur's Gate 3", // 4,00
        'Stardew Valley', // 3,50
      ]);
      expect(
        (desc.body.items as { rating: { average: number | null } }[])
          .slice(4)
          .every((game) => game.rating.average === null),
      ).toBe(true);

      const asc = await http().get('/games?sort=rating&order=asc').expect(200);
      expect(names(asc).slice(0, 4)).toEqual([
        'Stardew Valley',
        "Baldur's Gate 3",
        'Celeste',
        'Hollow Knight',
      ]);
    });

    it('ordena pela data de inclusão no catálogo', async () => {
      const res = await http().get('/games?sort=createdAt').expect(200);

      expect(names(res)).toEqual(GAMES.map((game) => game.name).reverse());
    });
  });

  describe('detalhes', () => {
    it('mostra o jogo com gêneros, plataformas, identificadores externos e média', async () => {
      const res = await http().get(`/games/${ids['Hollow Knight']}`).expect(200);

      expect(res.body).toEqual({
        id: ids['Hollow Knight'],
        name: 'Hollow Knight',
        description: 'Metroidvania em 2D.',
        coverUrl: 'https://example.com/hollow-knight.jpg',
        bannerUrl: null,
        stores: ['STEAM'],
        releaseDate: '2017-02-24',
        genres: [
          { slug: 'acao', name: 'ACAO' },
          { slug: 'aventura', name: 'AVENTURA' },
        ],
        platforms: [
          { slug: 'linux', name: 'LINUX' },
          { slug: 'windows', name: 'WINDOWS' },
        ],
        rating: { average: 5, count: 1 },
        externalIds: [
          {
            provider: 'STEAM',
            externalId: '367520',
            storeUrl: 'https://store.steampowered.com/app/367520',
          },
        ],
        updatedAt: expect.any(String),
      });
    });

    it('expõe a média com duas casas decimais', async () => {
      const res = await http().get(`/games/${ids['Stardew Valley']}`).expect(200);

      expect(res.body.rating).toEqual({ average: 3.5, count: 2 });
    });

    it('responde 404 para jogo inexistente e 400 para id que não é UUID', async () => {
      await http().get('/games/0199a0b2-7f3c-7a1e-9c4d-1234567890ab').expect(404);
      await http().get('/games/123').expect(400);
    });
  });

  it('lista gêneros e plataformas para os filtros, em ordem alfabética', async () => {
    const genres = await http().get('/genres').expect(200);
    const platforms = await http().get('/platforms').expect(200);

    expect((genres.body as { slug: string }[]).map((genre) => genre.slug)).toEqual([
      'acao',
      'aventura',
      'estrategia',
      'rpg',
      'simulacao',
    ]);
    expect(platforms.body).toEqual([
      { slug: 'linux', name: 'LINUX' },
      { slug: 'macos', name: 'MACOS' },
      { slug: 'windows', name: 'WINDOWS' },
    ]);
  });
});

describe('Catálogo: restrições no banco (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
    await resetDatabase(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('ordena nomes com acento e com minúscula em ordem alfabética (collation ICU)', async () => {
    for (const name of [
      'Zelda Ordem',
      'de Blob Ordem',
      'Aventura Ordem',
      'Ação Ordem',
      'Ábaco Ordem',
    ]) {
      await createGame(app, { name });
    }

    const res = await request(app.getHttpServer()).get('/games?q=ordem').expect(200);

    expect((res.body.items as { name: string }[]).map((game) => game.name)).toEqual([
      'Ábaco Ordem',
      'Ação Ordem',
      'Aventura Ordem',
      'de Blob Ordem',
      'Zelda Ordem',
    ]);
  });

  it('recusa capa ou banner que não sejam https', async () => {
    await expect(
      createGame(app, { name: 'Capa insegura', coverUrl: 'http://example.com/capa.jpg' }),
    ).rejects.toThrow(/games_cover_url_https_check/);
    await expect(
      createGame(app, { name: 'Banner inseguro', bannerUrl: 'javascript:alert(1)' }),
    ).rejects.toThrow(/games_banner_url_https_check/);
  });

  it('recusa o mesmo identificador externo em dois jogos do mesmo provedor', async () => {
    await createGame(app, { name: 'Original', steamAppId: '42' });

    await expect(createGame(app, { name: 'Cópia', steamAppId: '42' })).rejects.toMatchObject({
      code: 'P2002',
    });
  });

  it('recusa slug fora do formato', async () => {
    await expect(createGame(app, { name: 'Slug ruim', genres: ['Ação'] })).rejects.toThrow(
      /genres_slug_format_check/,
    );
  });
});
