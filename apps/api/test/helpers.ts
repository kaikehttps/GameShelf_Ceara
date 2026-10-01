import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { REFRESH_COOKIE_NAME } from '../src/auth/auth.constants.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/** Sobe a aplicação completa (mesmo pipeline do main.ts) contra o banco de teste. */
export async function createTestApp(): Promise<NestExpressApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();
  return app;
}

/** Apaga os dados entre testes, preservando a tabela de migrations do Prisma. */
export async function resetDatabase(app: INestApplication): Promise<void> {
  const prisma = app.get(PrismaService);
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length > 0) {
    const list = tables.map(({ tablename }) => `"public"."${tablename}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  }
}

let userCounter = 0;

export function uniqueEmail(prefix = 'user'): string {
  userCounter += 1;
  return `${prefix}-${process.pid}-${userCounter}@example.com`;
}

export const DEFAULT_PASSWORD = 'senha-de-teste-123';

export interface TestUser {
  id: string;
  email: string;
  accessToken: string;
  refreshCookie: string;
}

/** Cadastra um usuário pela API e devolve seus tokens. */
export async function registerUser(
  app: INestApplication,
  overrides: Partial<{ email: string; password: string; displayName: string }> = {},
): Promise<TestUser> {
  const email = overrides.email ?? uniqueEmail();
  const res = await request(app.getHttpServer())
    .post('/auth/register')
    .send({
      email,
      password: overrides.password ?? DEFAULT_PASSWORD,
      displayName: overrides.displayName ?? 'Pessoa Teste',
    })
    .expect(201);

  return {
    id: res.body.user.id,
    email,
    accessToken: res.body.accessToken,
    refreshCookie: extractRefreshCookie(res),
  };
}

export interface TestAccount {
  id: string;
  displayName: string;
  /** Pronto para `.set(...)` do supertest. */
  auth: { Authorization: string };
}

/**
 * Cria um usuário direto no banco e assina um access token válido. Mais rápido que o
 * cadastro e sem o rate limit dele (5/min), útil quando o teste precisa de vários usuários.
 */
export async function createAccount(
  app: INestApplication,
  displayName = 'Pessoa Teste',
): Promise<TestAccount> {
  const user = await app.get(PrismaService).user.create({
    // O login não é usado nesses testes, então o hash não precisa ser real.
    data: { email: uniqueEmail(), displayName, passwordHash: 'sem-login' },
    select: { id: true },
  });
  const accessToken = await app.get(JwtService).signAsync({ sub: user.id });
  return { id: user.id, displayName, auth: { Authorization: `Bearer ${accessToken}` } };
}

export interface GameFixture {
  name: string;
  description?: string;
  coverUrl?: string;
  bannerUrl?: string;
  /** "AAAA-MM-DD" */
  releaseDate?: string;
  genres?: string[];
  platforms?: string[];
  steamAppId?: string;
}

/** Grava um jogo direto no banco (a API não tem rota de escrita no catálogo). */
export async function createGame(app: INestApplication, fixture: GameFixture): Promise<string> {
  const toTaxonomy = (slug: string) => ({
    connectOrCreate: { where: { slug }, create: { slug, name: slug.toUpperCase() } },
  });
  const game = await app.get(PrismaService).game.create({
    data: {
      name: fixture.name,
      description: fixture.description,
      coverUrl: fixture.coverUrl,
      bannerUrl: fixture.bannerUrl,
      releaseDate: fixture.releaseDate ? new Date(fixture.releaseDate) : null,
      genres: { create: (fixture.genres ?? []).map((slug) => ({ genre: toTaxonomy(slug) })) },
      platforms: {
        create: (fixture.platforms ?? []).map((slug) => ({ platform: toTaxonomy(slug) })),
      },
      externalIds: fixture.steamAppId
        ? { create: { provider: 'STEAM', externalId: fixture.steamAppId } }
        : undefined,
    },
    select: { id: true },
  });
  return game.id;
}

/** Retorna "gs_refresh=<valor>" a partir do Set-Cookie da resposta. */
export function extractRefreshCookie(res: request.Response): string {
  const header = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = header?.find((value) => value.startsWith(`${REFRESH_COOKIE_NAME}=`));
  if (!cookie) {
    throw new Error('Resposta sem cookie de refresh');
  }
  return cookie.split(';')[0];
}

export function refreshTokenValue(cookie: string): string {
  return cookie.slice(`${REFRESH_COOKIE_NAME}=`.length);
}
