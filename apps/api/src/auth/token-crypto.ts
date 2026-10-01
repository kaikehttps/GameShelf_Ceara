import { createHash, randomBytes } from 'node:crypto';

/**
 * Gera um refresh token opaco com 256 bits de entropia.
 * O valor bruto só existe no cookie do cliente; o banco guarda apenas o hash.
 */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * SHA-256 é suficiente aqui porque o token é aleatório e longo (não é uma senha
 * escolhida por humanos): não existe dicionário para atacar o hash. Usar Argon2
 * em cada renovação só adicionaria custo sem ganho de segurança.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
