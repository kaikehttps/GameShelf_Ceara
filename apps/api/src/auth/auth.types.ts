import type { Request } from 'express';

/** Conteúdo do access token (JWT). Mantido mínimo de propósito. */
export interface AccessTokenPayload {
  sub: string;
}

export interface AuthenticatedUser {
  id: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
