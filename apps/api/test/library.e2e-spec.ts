import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  createAccount,
  createGame,
  createTestApp,
  resetDatabase,
  type TestAccount,
} from './helpers.js';

const MISSING_GAME_ID = '0199a0b2-7f3c-7a1e-9c4d-1234567890ab';

describe('Biblioteca pessoal (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let hades: string;
  let celeste: string;
  let ana: TestAccount;
  let bruno: TestAccount;

  // App novo por teste: o rate limit fica em memória, então cada teste começa do zero.
  beforeEach(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await resetDatabase(app);
    hades = await createGame(app, { name: 'Hades', genres: ['acao'] });
    celeste = await createGame(app, { name: 'Celeste' });
    ana = await createAccount(app, 'Ana');
    bruno = await createAccount(app, 'Bruno');
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const gameIds = (res: request.Response) =>
    (res.body.items as { game: { id: string } }[]).map((entry) => entry.game.id);

  it('exige autenticação em todas as rotas', async () => {
    await http().get('/library').expect(401);
    await http().post('/library').send({ gameId: hades }).expect(401);
    await http().patch(`/library/${hades}`).send({ status: 'PLAYING' }).expect(401);
    await http().delete(`/library/${hades}`).expect(401);
  });

  it('adiciona com o status padrão "quero jogar" e lista com os dados do jogo', async () => {
    const created = await http().post('/library').set(ana.auth).send({ gameId: hades }).expect(201);

    expect(created.body).toMatchObject({
      status: 'WANT_TO_PLAY',
      game: { id: hades, name: 'Hades', genres: [{ slug: 'acao' }] },
    });

    const list = await http().get('/library').set(ana.auth).expect(200);
    expect(list.body).toMatchObject({
      page: 1,
      total: 1,
      items: [{ status: 'WANT_TO_PLAY', game: { id: hades } }],
    });
  });

  it('impede adicionar o mesmo jogo duas vezes', async () => {
    await http()
      .post('/library')
      .set(ana.auth)
      .send({ gameId: hades, status: 'PLAYING' })
      .expect(201);
    await http().post('/library').set(ana.auth).send({ gameId: hades }).expect(409);

    expect(await prisma.libraryEntry.count({ where: { userId: ana.id } })).toBe(1);
  });

  it('impede a duplicação também com requisições simultâneas', async () => {
    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        http().post('/library').set(ana.auth).send({ gameId: hades }),
      ),
    );

    expect(responses.map((res) => res.status).sort()).toEqual([201, 409, 409, 409, 409]);
    expect(await prisma.libraryEntry.count({ where: { userId: ana.id } })).toBe(1);
  });

  it('valida o jogo e o status', async () => {
    const add = (body: object) => http().post('/library').set(ana.auth).send(body);

    await add({ gameId: MISSING_GAME_ID }).expect(404);
    await add({ gameId: 'nao-e-uuid' }).expect(400);
    await add({}).expect(400);
    await add({ gameId: hades, status: 'JOGANDO' }).expect(400);
    await add({ gameId: hades, status: null }).expect(400);
    await add({ gameId: hades, userId: bruno.id }).expect(400);
  });

  it('altera o status e filtra a lista por status', async () => {
    await http().post('/library').set(ana.auth).send({ gameId: hades }).expect(201);
    await http().post('/library').set(ana.auth).send({ gameId: celeste }).expect(201);
    // Datas antigas e fixas: a alteração abaixo fica, com certeza, como a mais recente.
    await prisma.libraryEntry.updateMany({
      where: { userId: ana.id },
      data: { updatedAt: new Date('2026-01-01T00:00:00Z') },
    });

    const updated = await http()
      .patch(`/library/${hades}`)
      .set(ana.auth)
      .send({ status: 'PLAYING' })
      .expect(200);
    expect(updated.body).toMatchObject({ status: 'PLAYING', game: { id: hades } });

    await http().patch(`/library/${hades}`).set(ana.auth).send({ status: 'JOGANDO' }).expect(400);
    await http().patch(`/library/${hades}`).set(ana.auth).send({ status: null }).expect(400);
    await http().patch(`/library/${hades}`).set(ana.auth).send({}).expect(400);

    const playing = await http().get('/library?status=PLAYING').set(ana.auth).expect(200);
    expect(gameIds(playing)).toEqual([hades]);

    const all = await http().get('/library').set(ana.auth).expect(200);
    expect(gameIds(all)).toEqual([hades, celeste]);
    await http().get('/library?status=JOGANDO').set(ana.auth).expect(400);
  });

  it('remove um jogo da biblioteca', async () => {
    await http().post('/library').set(ana.auth).send({ gameId: hades }).expect(201);

    await http().delete(`/library/${hades}`).set(ana.auth).expect(204);
    await http().delete(`/library/${hades}`).set(ana.auth).expect(404);
    await http().patch(`/library/${hades}`).set(ana.auth).send({ status: 'PLAYING' }).expect(404);
    expect((await http().get('/library').set(ana.auth).expect(200)).body.total).toBe(0);
  });

  it('isola as bibliotecas: um usuário não lê nem altera a de outro', async () => {
    await http()
      .post('/library')
      .set(ana.auth)
      .send({ gameId: hades, status: 'PLAYING' })
      .expect(201);

    expect((await http().get('/library').set(bruno.auth).expect(200)).body.total).toBe(0);
    await http()
      .patch(`/library/${hades}`)
      .set(bruno.auth)
      .send({ status: 'ABANDONED' })
      .expect(404);
    await http().delete(`/library/${hades}`).set(bruno.auth).expect(404);

    const anaLibrary = await http().get('/library').set(ana.auth).expect(200);
    expect(anaLibrary.body.items).toMatchObject([{ status: 'PLAYING', game: { id: hades } }]);

    // A restrição de unicidade é por usuário: Bruno pode ter o mesmo jogo.
    await http().post('/library').set(bruno.auth).send({ gameId: hades }).expect(201);
    expect(await prisma.libraryEntry.count({ where: { gameId: hades } })).toBe(2);
  });

  it('informa o status de vários jogos de uma vez, só da própria biblioteca', async () => {
    await http()
      .post('/library')
      .set(ana.auth)
      .send({ gameId: hades, status: 'PLAYING' })
      .expect(201);
    await http().post('/library').set(bruno.auth).send({ gameId: celeste }).expect(201);

    const res = await http()
      .get(`/library/status?gameIds=${hades},${celeste},${MISSING_GAME_ID}`)
      .set(ana.auth)
      .expect(200);

    // Celeste está na biblioteca do Bruno, não na da Ana: não aparece.
    expect(res.body).toEqual([{ gameId: hades, status: 'PLAYING' }]);
  });

  it('valida a lista de ids da consulta de status', async () => {
    const tooMany = Array.from({ length: 51 }, () => hades).join(',');

    await http().get('/library/status').set(ana.auth).expect(400);
    await http().get('/library/status?gameIds=nao-e-uuid').set(ana.auth).expect(400);
    await http().get(`/library/status?gameIds=${tooMany}`).set(ana.auth).expect(400);
    await http().get(`/library/status?gameIds=${hades}`).expect(401);
  });

  it('o banco recusa entrada duplicada mesmo sem passar pela API', async () => {
    const data = { userId: ana.id, gameId: hades, status: 'PLAYING' as const };
    await prisma.libraryEntry.create({ data });

    await expect(prisma.libraryEntry.create({ data })).rejects.toMatchObject({ code: 'P2002' });
  });
});
