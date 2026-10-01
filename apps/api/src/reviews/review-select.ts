import type { Prisma } from '../generated/prisma/client.js';

/** O autor aparece só com id e nome de exibição: o e-mail nunca sai nas avaliações. */
export const reviewSelect = {
  id: true,
  rating: true,
  comment: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, displayName: true } },
} satisfies Prisma.ReviewSelect;

export type ReviewPayload = Prisma.ReviewGetPayload<{ select: typeof reviewSelect }>;
