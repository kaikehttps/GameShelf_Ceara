import { describe, expect, it } from 'vitest';
import { PasswordHasher } from './password-hasher.js';

describe('PasswordHasher', () => {
  const hasher = new PasswordHasher();

  it('gera hash Argon2id com os parâmetros da OWASP e sem a senha em texto', async () => {
    const hashed = await hasher.hash('uma-senha-bem-longa');

    expect(hashed).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(hashed).not.toContain('uma-senha-bem-longa');
  });

  it('usa salt aleatório: a mesma senha gera hashes diferentes', async () => {
    const [a, b] = await Promise.all([
      hasher.hash('mesma-senha-123'),
      hasher.hash('mesma-senha-123'),
    ]);

    expect(a).not.toBe(b);
  });

  it('verifica a senha correta e recusa a incorreta', async () => {
    const hashed = await hasher.hash('senha-correta-123');

    await expect(hasher.verify(hashed, 'senha-correta-123')).resolves.toBe(true);
    await expect(hasher.verify(hashed, 'senha-errada-1234')).resolves.toBe(false);
  });

  it('retorna false (sem lançar erro) para hash em formato inválido', async () => {
    await expect(hasher.verify('nao-e-um-hash', 'qualquer')).resolves.toBe(false);
  });

  it('reaproveita o hash fictício entre chamadas', async () => {
    const first = await hasher.dummyHash();

    await expect(hasher.dummyHash()).resolves.toBe(first);
    await expect(hasher.verify(first, 'qualquer-senha')).resolves.toBe(false);
  });
});
