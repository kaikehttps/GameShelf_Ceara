import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  createAccount,
  createGame,
  createTestApp,
  resetDatabase,
  type TestAccount,
} from './helpers.js';

const MISSING_GAME_ID = '0199a0b2-7f3c-7a1e-9c4d-1234567890ab';

describe('Avaliações (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let game: string;
  let otherGame: string;
  let ana: TestAccount;
  let bruno: TestAccount;
  let carla: TestAccount;

  // App novo por teste: o rate limit fica em memória, então cada teste começa do zero.
  beforeEach(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await resetDatabase(app);
    game = await createGame(app, { name: 'Hades' });
    otherGame = await createGame(app, { name: 'Celeste' });
    ana = await createAccount(app, 'Ana');
    bruno = await createAccount(app, 'Bruno');
    carla = await createAccount(app, 'Carla');
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const reviewsOf = (gameId: string) => `/games/${gameId}/reviews`;
  const ratingOf = async (gameId: string) =>
    (await http().get(`/games/${gameId}`).expect(200)).body.rating as {
      average: number | null;
      count: number;
    };
  const review = (account: TestAccount, body: object, gameId = game) =>
    http().post(reviewsOf(gameId)).set(account.auth).send(body);

  it('lista sem autenticação, mas exige login para avaliar', async () => {
    const res = await http().get(reviewsOf(game)).expect(200);

    expect(res.body).toMatchObject({ items: [], total: 0 });
    await http().get(reviewsOf(MISSING_GAME_ID)).expect(404);
    await http().post(reviewsOf(game)).send({ rating: 5 }).expect(401);
    await http()
      .get(`${reviewsOf(game)}/me`)
      .expect(401);
    await http()
      .patch(`${reviewsOf(game)}/me`)
      .send({ rating: 1 })
      .expect(401);
    await http()
      .delete(`${reviewsOf(game)}/me`)
      .expect(401);
  });

  it('cria a avaliação e atualiza média e quantidade do jogo', async () => {
    expect(await ratingOf(game)).toEqual({ average: null, count: 0 });

    const res = await review(ana, { rating: 4, comment: '  Muito bom.  ' }).expect(201);

    expect(res.body).toEqual({
      id: expect.any(String),
      rating: 4,
      comment: 'Muito bom.',
      author: { id: ana.id, displayName: 'Ana' },
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(await ratingOf(game)).toEqual({ average: 4, count: 1 });
    await review(ana, { rating: 5 }, MISSING_GAME_ID).expect(404);
  });

  it('permite uma única avaliação por usuário e jogo', async () => {
    await review(ana, { rating: 5 }).expect(201);
    await review(ana, { rating: 1 }).expect(409);

    expect(await ratingOf(game)).toEqual({ average: 5, count: 1 });
    // A restrição é por jogo: Ana pode avaliar outro.
    await review(ana, { rating: 3 }, otherGame).expect(201);
  });

  it('recusa notas inválidas e comentários longos', async () => {
    const invalid = [
      { rating: 0 },
      { rating: 6 },
      { rating: 4.5 },
      { rating: '5' },
      { rating: null },
      {},
      { rating: 5, comment: 'x'.repeat(1001) },
      { rating: 5, comment: 42 },
      { rating: 5, userId: bruno.id },
    ];
    for (const body of invalid) {
      await review(ana, body).expect(400);
    }

    await review(ana, { rating: 5, comment: 'x'.repeat(1000) }).expect(201);
    expect(await ratingOf(game)).toEqual({ average: 5, count: 1 });
  });

  it('mantém a média correta após criações, edições e exclusões', async () => {
    await review(ana, { rating: 5 }).expect(201);
    await review(bruno, { rating: 4 }).expect(201);
    await review(carla, { rating: 4 }).expect(201);
    expect(await ratingOf(game)).toEqual({ average: 4.33, count: 3 });

    await http()
      .patch(`${reviewsOf(game)}/me`)
      .set(ana.auth)
      .send({ rating: 2 })
      .expect(200);
    expect(await ratingOf(game)).toEqual({ average: 3.33, count: 3 });

    await http()
      .delete(`${reviewsOf(game)}/me`)
      .set(bruno.auth)
      .expect(204);
    expect(await ratingOf(game)).toEqual({ average: 3, count: 2 });

    await http()
      .delete(`${reviewsOf(game)}/me`)
      .set(ana.auth)
      .expect(204);
    await http()
      .delete(`${reviewsOf(game)}/me`)
      .set(carla.auth)
      .expect(204);
    expect(await ratingOf(game)).toEqual({ average: null, count: 0 });
    // A outra avaliação de um jogo não interfere nos agregados deste.
    expect(await ratingOf(otherGame)).toEqual({ average: null, count: 0 });
  });

  it('edita só os campos enviados; texto vazio ou null remove o comentário', async () => {
    await review(ana, { rating: 5, comment: 'Ótimo' }).expect(201);
    const mine = () =>
      http()
        .patch(`${reviewsOf(game)}/me`)
        .set(ana.auth);

    expect((await mine().send({ comment: '   ' }).expect(200)).body).toMatchObject({
      rating: 5,
      comment: null,
    });
    expect((await mine().send({ rating: 3 }).expect(200)).body).toMatchObject({
      rating: 3,
      comment: null,
    });
    expect((await mine().send({ comment: 'Voltei' }).expect(200)).body).toMatchObject({
      rating: 3,
      comment: 'Voltei',
    });
    expect((await mine().send({ comment: null }).expect(200)).body.comment).toBeNull();
    await mine().send({ rating: null }).expect(400);
    await mine().send({ rating: 7 }).expect(400);

    const res = await http()
      .get(`${reviewsOf(game)}/me`)
      .set(ana.auth)
      .expect(200);
    expect(res.body).toMatchObject({ rating: 3, comment: null });
  });

  it('um usuário não consegue ler como sua, editar nem excluir a avaliação de outro', async () => {
    await review(ana, { rating: 5, comment: 'Da Ana' }).expect(201);

    await http()
      .get(`${reviewsOf(game)}/me`)
      .set(bruno.auth)
      .expect(404);
    await http()
      .patch(`${reviewsOf(game)}/me`)
      .set(bruno.auth)
      .send({ rating: 1 })
      .expect(404);
    await http()
      .delete(`${reviewsOf(game)}/me`)
      .set(bruno.auth)
      .expect(404);

    const res = await http()
      .get(`${reviewsOf(game)}/me`)
      .set(ana.auth)
      .expect(200);
    expect(res.body).toMatchObject({ rating: 5, comment: 'Da Ana' });
    expect(await ratingOf(game)).toEqual({ average: 5, count: 1 });
  });

  it('lista as mais recentes primeiro, paginadas, com o autor e sem e-mail', async () => {
    for (const [index, account] of [ana, bruno, carla].entries()) {
      await review(account, { rating: 3 + index }).expect(201);
      // Datas distintas e conhecidas, para a ordem não depender do relógio.
      await prisma.review.update({
        where: { userId_gameId: { userId: account.id, gameId: game } },
        data: { createdAt: new Date(Date.UTC(2026, 0, index + 1)) },
      });
    }

    const first = await http()
      .get(`${reviewsOf(game)}?pageSize=2`)
      .expect(200);
    expect(first.body).toMatchObject({ total: 3, totalPages: 2 });
    const authors = (first.body.items as { author: { id: string; displayName: string } }[]).map(
      (item) => item.author,
    );
    expect(authors).toEqual([
      { id: carla.id, displayName: 'Carla' },
      { id: bruno.id, displayName: 'Bruno' },
    ]);

    const second = await http()
      .get(`${reviewsOf(game)}?pageSize=2&page=2`)
      .expect(200);
    expect(second.body.items).toMatchObject([{ author: { displayName: 'Ana' } }]);
    expect(JSON.stringify([first.body, second.body])).not.toMatch(/email|passwordHash/);
  });

  it('mantém média e quantidade corretas com avaliações e edições simultâneas', async () => {
    const accounts = await Promise.all(
      Array.from({ length: 20 }, (_, index) => createAccount(app, `Pessoa ${index}`)),
    );

    // Notas de 1 a 5, quatro de cada: soma 60, média 3.
    const created = await Promise.all(
      accounts.map((account, index) => review(account, { rating: (index % 5) + 1 })),
    );
    expect(created.every((res) => res.status === 201)).toBe(true);
    expect(await ratingOf(game)).toEqual({ average: 3, count: 20 });

    const edited = await Promise.all(
      accounts.map((account) =>
        http()
          .patch(`${reviewsOf(game)}/me`)
          .set(account.auth)
          .send({ rating: 5 }),
      ),
    );
    expect(edited.every((res) => res.status === 200)).toBe(true);

    const stored = await prisma.game.findUniqueOrThrow({ where: { id: game } });
    expect(stored).toMatchObject({ ratingCount: 20, ratingSum: 100 });
    expect(stored.ratingAverage?.toNumber()).toBe(5);
  });

  it('atualiza a média quando um usuário é removido (exclusão em cascata)', async () => {
    await review(ana, { rating: 5 }).expect(201);
    await review(bruno, { rating: 1 }).expect(201);
    expect(await ratingOf(game)).toEqual({ average: 3, count: 2 });

    await prisma.user.delete({ where: { id: bruno.id } });

    expect(await ratingOf(game)).toEqual({ average: 5, count: 1 });
  });
});

describe('Avaliações: restrições no banco (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let game: string;
  let ana: TestAccount;
  let bruno: TestAccount;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(app);
    game = await createGame(app, { name: 'Hades' });
    ana = await createAccount(app, 'Ana');
    bruno = await createAccount(app, 'Bruno');
  });

  afterAll(async () => {
    await app.close();
  });

  const aggregates = () =>
    prisma.game
      .findUniqueOrThrow({
        where: { id: game },
        select: { ratingCount: true, ratingSum: true, ratingAverage: true },
      })
      .then(({ ratingAverage, ...rest }) => ({
        ...rest,
        ratingAverage: ratingAverage?.toNumber() ?? null,
      }));

  // Mesmo que algum código ignore a validação da API, o banco recusa dados inválidos.
  it('recusa nota fora de 1 a 5 gravada diretamente', async () => {
    await expect(
      prisma.review.create({ data: { userId: ana.id, gameId: game, rating: 6 } }),
    ).rejects.toThrow(/reviews_rating_range_check/);
    await expect(
      prisma.review.create({ data: { userId: ana.id, gameId: game, rating: 0 } }),
    ).rejects.toThrow(/reviews_rating_range_check/);
  });

  it('recusa segunda avaliação do mesmo usuário gravada diretamente', async () => {
    const data = { userId: ana.id, gameId: game, rating: 4 };
    await prisma.review.create({ data });

    await expect(prisma.review.create({ data })).rejects.toMatchObject({ code: 'P2002' });
  });

  it('a trigger mantém os agregados mesmo em escritas que não passam pela API', async () => {
    await prisma.review.create({ data: { userId: ana.id, gameId: game, rating: 5 } });
    await prisma.review.create({ data: { userId: bruno.id, gameId: game, rating: 2 } });
    expect(await aggregates()).toEqual({ ratingCount: 2, ratingSum: 7, ratingAverage: 3.5 });

    await prisma.$executeRaw`UPDATE reviews SET rating = 1 WHERE game_id = ${game}::uuid`;
    expect(await aggregates()).toEqual({ ratingCount: 2, ratingSum: 2, ratingAverage: 1 });

    await prisma.review.deleteMany({ where: { gameId: game } });
    expect(await aggregates()).toEqual({ ratingCount: 0, ratingSum: 0, ratingAverage: null });
  });

  it('move os agregados quando uma avaliação troca de jogo', async () => {
    const other = await createGame(app, { name: 'Celeste' });
    await prisma.review.create({ data: { userId: ana.id, gameId: game, rating: 4 } });

    await prisma.review.updateMany({ where: { userId: ana.id }, data: { gameId: other } });

    expect(await aggregates()).toEqual({ ratingCount: 0, ratingSum: 0, ratingAverage: null });
    const moved = await prisma.game.findUniqueOrThrow({ where: { id: other } });
    expect(moved).toMatchObject({ ratingCount: 1, ratingSum: 4 });
  });

  it('recusa agregados incoerentes gravados diretamente', async () => {
    await expect(
      prisma.game.update({ where: { id: game }, data: { ratingCount: 1 } }),
    ).rejects.toThrow(/games_rating_aggregates_check/);
  });
});
