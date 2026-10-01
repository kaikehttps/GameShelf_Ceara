import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hashToken } from '../src/auth/token-crypto.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  createTestApp,
  DEFAULT_PASSWORD,
  extractRefreshCookie,
  refreshTokenValue,
  registerUser,
  resetDatabase,
  uniqueEmail,
} from './helpers.js';

describe('Autenticação (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // App novo por teste: o rate limit fica em memória, então cada teste começa do zero.
  beforeEach(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await resetDatabase(app);
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  /** Simula que a rotação do token aconteceu há `ms` milissegundos. */
  const ageRotation = (refreshCookie: string, ms: number) =>
    prisma.refreshToken.update({
      where: { tokenHash: hashToken(refreshTokenValue(refreshCookie)) },
      data: { revokedAt: new Date(Date.now() - ms) },
    });

  describe('cadastro', () => {
    it('cria a conta, devolve access token e define o refresh token em cookie seguro', async () => {
      const email = uniqueEmail();
      const res = await http()
        .post('/auth/register')
        .send({ email: email.toUpperCase(), password: DEFAULT_PASSWORD, displayName: ' Ana ' })
        .expect(201);

      expect(res.body).toMatchObject({
        tokenType: 'Bearer',
        expiresIn: 900,
        user: { email, displayName: 'Ana', bio: null },
      });
      expect(typeof res.body.accessToken).toBe('string');
      expect(Object.keys(res.body.user).sort()).toEqual(
        ['bio', 'createdAt', 'displayName', 'email', 'id'].sort(),
      );
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|tokenHash|argon2/i);

      const setCookie = (res.headers['set-cookie'] as unknown as string[]).join(';');
      expect(setCookie).toMatch(/gs_refresh=/);
      expect(setCookie).toMatch(/HttpOnly/i);
      expect(setCookie).toMatch(/SameSite=Strict/i);
      expect(setCookie).toMatch(/Path=\/auth/);
      expect(setCookie).toMatch(/Secure/);
      // O refresh token não aparece no corpo da resposta.
      expect(JSON.stringify(res.body)).not.toContain(refreshTokenValue(extractRefreshCookie(res)));
    });

    it('rejeita e-mail duplicado, mesmo com maiúsculas diferentes', async () => {
      const user = await registerUser(app);

      await http()
        .post('/auth/register')
        .send({ email: user.email.toUpperCase(), password: DEFAULT_PASSWORD, displayName: 'Outra' })
        .expect(409);
    });

    it('valida a entrada e recusa campos desconhecidos', async () => {
      await http()
        .post('/auth/register')
        .send({ email: 'nao-e-email', password: 'curta', displayName: 'A' })
        .expect(400);

      await http()
        .post('/auth/register')
        .send({
          email: uniqueEmail(),
          password: DEFAULT_PASSWORD,
          displayName: 'Ana',
          role: 'admin',
        })
        .expect(400);
    });

    it('guarda apenas o hash da senha (Argon2id)', async () => {
      const user = await registerUser(app);
      const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

      expect(stored.passwordHash).not.toContain(DEFAULT_PASSWORD);
      expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
    });
  });

  describe('login', () => {
    it('autentica com credenciais corretas', async () => {
      const user = await registerUser(app);

      const res = await http()
        .post('/auth/login')
        .send({ email: user.email, password: DEFAULT_PASSWORD })
        .expect(200);

      expect(res.body.user.id).toBe(user.id);
      expect(extractRefreshCookie(res)).toMatch(/^gs_refresh=/);
    });

    it('responde 401 com a mesma mensagem para senha errada e e-mail inexistente', async () => {
      const user = await registerUser(app);

      const wrongPassword = await http()
        .post('/auth/login')
        .send({ email: user.email, password: 'senha-errada-123' })
        .expect(401);
      const unknownEmail = await http()
        .post('/auth/login')
        .send({ email: uniqueEmail('ninguem'), password: DEFAULT_PASSWORD })
        .expect(401);

      expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
      expect(wrongPassword.headers['set-cookie']).toBeUndefined();
    });

    it('limita tentativas de login por IP (429 após 5 tentativas por minuto)', async () => {
      const email = uniqueEmail();
      for (let attempt = 1; attempt <= 5; attempt++) {
        await http().post('/auth/login').send({ email, password: 'senha-errada-123' }).expect(401);
      }
      await http().post('/auth/login').send({ email, password: 'senha-errada-123' }).expect(429);
    });
  });

  describe('rotas protegidas', () => {
    it('recusa acesso sem token, com token malformado e com assinatura inválida', async () => {
      const user = await registerUser(app);
      const forged = new JwtService().sign(
        { sub: user.id },
        { secret: 'outro-segredo-com-mais-de-32-caracteres!!', issuer: 'gameshelf-api' },
      );

      await http().get('/users/me').expect(401);
      await http().get('/users/me').set('Authorization', 'Bearer abc.def.ghi').expect(401);
      await http().get('/users/me').set('Authorization', `Bearer ${forged}`).expect(401);
      await http().get('/users/me').set('Authorization', user.accessToken).expect(401);
    });

    it('recusa token expirado', async () => {
      const user = await registerUser(app);
      const expired = app.get(JwtService).sign({ sub: user.id }, { expiresIn: -10 });

      await http().get('/users/me').set('Authorization', `Bearer ${expired}`).expect(401);
    });

    it('permite acesso com access token válido', async () => {
      const user = await registerUser(app);

      const res = await http()
        .get('/users/me')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(res.body.id).toBe(user.id);
      expect(res.body).not.toHaveProperty('passwordHash');
    });
  });

  describe('refresh token', () => {
    it('rotaciona: o token antigo é revogado e um novo é emitido', async () => {
      const user = await registerUser(app);

      const first = await http()
        .post('/auth/refresh')
        .set('Cookie', user.refreshCookie)
        .expect(200);
      const rotatedCookie = extractRefreshCookie(first);
      expect(rotatedCookie).not.toBe(user.refreshCookie);
      expect(typeof first.body.accessToken).toBe('string');

      // O novo token funciona normalmente.
      await http().post('/auth/refresh').set('Cookie', rotatedCookie).expect(200);

      const oldRow = await prisma.refreshToken.findUniqueOrThrow({
        where: { tokenHash: hashToken(refreshTokenValue(user.refreshCookie)) },
      });
      expect(oldRow.revokedReason).toBe('ROTATED');
      expect(oldRow.replacedById).not.toBeNull();
    });

    it('detecta reutilização e revoga a sessão inteira', async () => {
      const user = await registerUser(app);
      const rotated = await http()
        .post('/auth/refresh')
        .set('Cookie', user.refreshCookie)
        .expect(200);
      const legitimateCookie = extractRefreshCookie(rotated);
      await ageRotation(user.refreshCookie, 60_000);

      // Um token já rotacionado é reapresentado (ex.: foi copiado por um atacante).
      await http().post('/auth/refresh').set('Cookie', user.refreshCookie).expect(401);

      // A família foi revogada: nem o token legítimo mais recente funciona.
      await http().post('/auth/refresh').set('Cookie', legitimateCookie).expect(401);

      const tokens = await prisma.refreshToken.findMany({ where: { userId: user.id } });
      expect(tokens.every((token) => token.revokedAt !== null)).toBe(true);
      expect(tokens.some((token) => token.revokedReason === 'REUSE_DETECTED')).toBe(true);
    });

    it('dentro da janela de tolerância, reapresentar o token antigo é recusado sem derrubar a sessão', async () => {
      const user = await registerUser(app);
      const rotated = await http()
        .post('/auth/refresh')
        .set('Cookie', user.refreshCookie)
        .expect(200);

      // Ex.: duas abas renovando quase ao mesmo tempo.
      await http().post('/auth/refresh').set('Cookie', user.refreshCookie).expect(401);

      await http().post('/auth/refresh').set('Cookie', extractRefreshCookie(rotated)).expect(200);
    });

    it('respeita a expiração absoluta da sessão, mesmo com rotações', async () => {
      const user = await registerUser(app);
      const rows = await prisma.refreshToken.findMany({ where: { userId: user.id } });
      expect(rows[0].expiresAt.getTime()).toBeLessThanOrEqual(rows[0].sessionExpiresAt.getTime());

      // Sessão quase no fim do limite absoluto (o banco exige expiresAt <= sessionExpiresAt).
      await prisma.refreshToken.updateMany({
        where: { userId: user.id },
        data: {
          expiresAt: new Date(Date.now() + 30_000),
          sessionExpiresAt: new Date(Date.now() + 60_000),
        },
      });
      const rotated = await http()
        .post('/auth/refresh')
        .set('Cookie', user.refreshCookie)
        .expect(200);

      const newRow = await prisma.refreshToken.findUniqueOrThrow({
        where: { tokenHash: hashToken(refreshTokenValue(extractRefreshCookie(rotated))) },
      });
      // A nova expiração nunca ultrapassa o limite absoluto da sessão.
      expect(newRow.expiresAt.getTime()).toBe(newRow.sessionExpiresAt.getTime());
    });

    it('permite apenas uma rotação quando o mesmo token é usado em paralelo', async () => {
      const user = await registerUser(app);

      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          http().post('/auth/refresh').set('Cookie', user.refreshCookie),
        ),
      );

      expect(results.filter((res) => res.status === 200)).toHaveLength(1);
      expect(results.filter((res) => res.status === 401)).toHaveLength(4);
    });

    it('recusa refresh token expirado', async () => {
      const user = await registerUser(app);
      await prisma.refreshToken.updateMany({
        where: { userId: user.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      await http().post('/auth/refresh').set('Cookie', user.refreshCookie).expect(401);
    });

    it('recusa refresh sem cookie ou com valor desconhecido e limpa o cookie', async () => {
      await http().post('/auth/refresh').expect(401);
      const res = await http()
        .post('/auth/refresh')
        .set('Cookie', 'gs_refresh=inexistente')
        .expect(401);

      expect((res.headers['set-cookie'] as unknown as string[]).join(';')).toMatch(
        /gs_refresh=;.*Expires=Thu, 01 Jan 1970/,
      );
    });

    it('guarda no banco apenas o hash do refresh token', async () => {
      const user = await registerUser(app);
      const raw = refreshTokenValue(user.refreshCookie);

      const rows = await prisma.refreshToken.findMany({ where: { userId: user.id } });
      expect(rows).toHaveLength(1);
      expect(rows[0].tokenHash).toBe(hashToken(raw));
      expect(rows[0].tokenHash).not.toBe(raw);
    });
  });

  describe('proteção contra CSRF nas rotas com cookie', () => {
    it('recusa refresh disparado por outro site (Sec-Fetch-Site: cross-site)', async () => {
      const user = await registerUser(app);

      await http()
        .post('/auth/refresh')
        .set('Cookie', user.refreshCookie)
        .set('Sec-Fetch-Site', 'cross-site')
        .set('Origin', 'https://site-malicioso.example')
        .expect(403);
    });

    it('recusa Origin desconhecida quando o navegador não envia Sec-Fetch-Site', async () => {
      const user = await registerUser(app);

      await http()
        .post('/auth/refresh')
        .set('Cookie', user.refreshCookie)
        .set('Origin', 'https://site-malicioso.example')
        .expect(403);
    });

    it('aceita a origem do frontend configurada', async () => {
      const user = await registerUser(app);

      await http()
        .post('/auth/refresh')
        .set('Cookie', user.refreshCookie)
        .set('Sec-Fetch-Site', 'same-site')
        .set('Origin', 'http://localhost:5173')
        .expect(200);
    });
  });

  describe('logout', () => {
    it('revoga a sessão e limpa o cookie', async () => {
      const user = await registerUser(app);

      const res = await http().post('/auth/logout').set('Cookie', user.refreshCookie).expect(204);
      expect((res.headers['set-cookie'] as unknown as string[]).join(';')).toMatch(/gs_refresh=;/);

      await http().post('/auth/refresh').set('Cookie', user.refreshCookie).expect(401);
      const row = await prisma.refreshToken.findFirstOrThrow({ where: { userId: user.id } });
      expect(row.revokedReason).toBe('LOGOUT');
    });

    it('encerra só a sessão atual, mantendo outras sessões do mesmo usuário', async () => {
      const user = await registerUser(app);
      const otherDevice = await http()
        .post('/auth/login')
        .send({ email: user.email, password: DEFAULT_PASSWORD })
        .expect(200);

      await http().post('/auth/logout').set('Cookie', user.refreshCookie).expect(204);

      await http()
        .post('/auth/refresh')
        .set('Cookie', extractRefreshCookie(otherDevice))
        .expect(200);
    });

    it('é idempotente sem cookie', async () => {
      await http().post('/auth/logout').expect(204);
    });
  });
});

describe('Perfil (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
    await resetDatabase(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('edita o próprio perfil sem permitir troca de e-mail ou senha', async () => {
    const user = await registerUser(app);
    const auth = { Authorization: `Bearer ${user.accessToken}` };

    const updated = await request(app.getHttpServer())
      .patch('/users/me')
      .set(auth)
      .send({ displayName: 'Novo Nome', bio: 'Gosto de RPG.' })
      .expect(200);
    expect(updated.body).toMatchObject({ displayName: 'Novo Nome', bio: 'Gosto de RPG.' });

    await request(app.getHttpServer())
      .patch('/users/me')
      .set(auth)
      .send({ email: 'outro@example.com' })
      .expect(400);
    await request(app.getHttpServer())
      .patch('/users/me')
      .set(auth)
      .send({ passwordHash: 'x' })
      .expect(400);
  });

  it('cada usuário só enxerga o próprio perfil', async () => {
    const ana = await registerUser(app, { displayName: 'Ana' });
    const bruno = await registerUser(app, { displayName: 'Bruno' });

    const res = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${bruno.accessToken}`)
      .expect(200);

    expect(res.body.id).toBe(bruno.id);
    expect(res.body.id).not.toBe(ana.id);
  });

  it('remove a bio quando recebe string vazia', async () => {
    const user = await registerUser(app);
    const auth = { Authorization: `Bearer ${user.accessToken}` };
    await request(app.getHttpServer()).patch('/users/me').set(auth).send({ bio: 'Algo' });

    const res = await request(app.getHttpServer())
      .patch('/users/me')
      .set(auth)
      .send({ bio: '' })
      .expect(200);

    expect(res.body.bio).toBeNull();
  });

  it('recusa null no nome de exibição (400, não 500)', async () => {
    const user = await registerUser(app);

    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ displayName: null })
      .expect(400);
  });
});

describe('Restrições no banco (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await resetDatabase(app);
  });

  afterAll(async () => {
    await app.close();
  });

  // Mesmo que algum código ignore a validação da API, o banco recusa dados inválidos.
  it('recusa e-mail com maiúsculas gravado diretamente no banco', async () => {
    await expect(
      prisma.user.create({
        data: { email: 'Ana@Example.com', displayName: 'Ana', passwordHash: 'x' },
      }),
    ).rejects.toThrow(/users_email_lowercase_check/);
  });

  it('recusa e-mail duplicado gravado diretamente no banco', async () => {
    const data = { email: 'dup@example.com', displayName: 'Dup', passwordHash: 'x' };
    await prisma.user.create({ data });

    await expect(prisma.user.create({ data })).rejects.toMatchObject({ code: 'P2002' });
  });
});
