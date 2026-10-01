import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.js';

const validEnv = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
};

describe('validateEnv', () => {
  it('aplica valores padrão e converte tipos', () => {
    const env = validateEnv({ ...validEnv, PORT: '4000', COOKIE_SECURE: 'true' });

    expect(env.PORT).toBe(4000);
    expect(env.COOKIE_SECURE).toBe(true);
    expect(env.JWT_ACCESS_TTL_SECONDS).toBe(900);
    expect(env.NODE_ENV).toBe('development');
  });

  it('mantém cookies seguros por padrão e aceita desativar explicitamente', () => {
    expect(validateEnv(validEnv).COOKIE_SECURE).toBe(true);
    expect(validateEnv({ ...validEnv, COOKIE_SECURE: 'false' }).COOKIE_SECURE).toBe(false);
  });

  it('falha quando o segredo do JWT é curto demais', () => {
    expect(() => validateEnv({ ...validEnv, JWT_ACCESS_SECRET: 'curto' })).toThrow(
      /JWT_ACCESS_SECRET/,
    );
  });

  it('falha quando DATABASE_URL está ausente', () => {
    expect(() => validateEnv({ JWT_ACCESS_SECRET: 'x'.repeat(32) })).toThrow(/DATABASE_URL/);
  });
});
