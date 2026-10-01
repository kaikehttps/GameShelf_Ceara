import { Prisma } from '../generated/prisma/client.js';

/** P2002 = violação de restrição UNIQUE. */
export function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/** P2025 = o registro que um update/delete exige não existe. */
export function isRecordNotFoundError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}
