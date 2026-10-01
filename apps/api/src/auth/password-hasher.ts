import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import { randomBytes } from 'node:crypto';

/**
 * Parâmetros mínimos recomendados pela OWASP para Argon2id
 * (19 MiB de memória, 2 iterações, paralelismo 1). Argon2id é o algoritmo padrão
 * da biblioteca, por isso não o informamos explicitamente.
 */
const ARGON2_OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

@Injectable()
export class PasswordHasher {
  private dummy?: Promise<string>;

  hash(password: string): Promise<string> {
    return hash(password, ARGON2_OPTIONS);
  }

  /** A comparação acontece dentro da biblioteca, em tempo constante. */
  async verify(passwordHash: string, password: string): Promise<boolean> {
    try {
      return await verify(passwordHash, password);
    } catch {
      // Hash armazenado em formato inválido: tratamos como senha incorreta.
      return false;
    }
  }

  /** Hash de uma senha aleatória, usado no login para igualar o tempo de resposta. */
  dummyHash(): Promise<string> {
    this.dummy ??= this.hash(randomBytes(32).toString('hex'));
    return this.dummy;
  }
}
