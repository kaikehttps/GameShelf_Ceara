import { describe, expect, it } from 'vitest';
import { generateOpaqueToken, hashToken } from './token-crypto.js';

describe('token-crypto', () => {
  it('gera tokens url-safe com 256 bits e sem repetição', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateOpaqueToken()));

    expect(tokens.size).toBe(100);
    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }
  });

  it('produz um hash SHA-256 determinístico e diferente do token', () => {
    const token = generateOpaqueToken();

    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashToken(token)).not.toContain(token);
  });
});
