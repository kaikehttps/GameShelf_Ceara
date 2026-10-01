import { inject } from 'vitest';

// Executa antes de cada arquivo de teste e2e, antes de o AppModule ser importado.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = inject('databaseUrl');
process.env.JWT_ACCESS_SECRET = 'test-secret-with-at-least-32-characters!!';
process.env.COOKIE_SECURE = 'true';
process.env.CORS_ORIGINS = 'http://localhost:5173';
