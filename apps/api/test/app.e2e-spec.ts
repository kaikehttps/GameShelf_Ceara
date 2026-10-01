import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './helpers.js';

describe('Aplicação (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('liveness responde sem autenticação', async () => {
    const res = await request(app.getHttpServer()).get('/health/live').expect(200);

    expect(res.body).toEqual({ status: 'ok' });
  });

  it('readiness confirma o banco de dados', async () => {
    const res = await request(app.getHttpServer()).get('/health/ready').expect(200);

    expect(res.body).toEqual({ status: 'ok', checks: { database: 'up' } });
  });

  it('envia cabeçalhos de segurança e não expõe o X-Powered-By', async () => {
    const res = await request(app.getHttpServer()).get('/health/live');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('publica o documento OpenAPI com as rotas e esquemas de segurança', async () => {
    const res = await request(app.getHttpServer()).get('/docs-json').expect(200);

    expect(Object.keys(res.body.paths)).toEqual(
      expect.arrayContaining([
        '/auth/register',
        '/auth/login',
        '/auth/refresh',
        '/auth/logout',
        '/users/me',
        '/games',
        '/games/{id}',
        '/genres',
        '/platforms',
        '/library',
        '/library/status',
        '/library/{gameId}',
        '/games/{gameId}/reviews',
        '/games/{gameId}/reviews/me',
      ]),
    );
    expect(res.body.components.securitySchemes).toHaveProperty('bearer');
    expect(res.body.components.securitySchemes).toHaveProperty('cookie');
  });

  it('responde 404 para rota inexistente', async () => {
    await request(app.getHttpServer()).get('/nao-existe').expect(404);
  });
});
