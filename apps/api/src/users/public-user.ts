import type { Prisma } from '../generated/prisma/client.js';

/**
 * Colunas que podem sair do banco quando lemos um usuário para responder ao cliente.
 * Selecionar explicitamente evita que um campo novo e sensível vaze por acidente.
 */
export const publicUserSelect = {
  id: true,
  email: true,
  displayName: true,
  bio: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;
