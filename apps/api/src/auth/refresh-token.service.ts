import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { Env } from '../config/env.js';
import { RefreshTokenRevocationReason } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { REFRESH_REUSE_GRACE_MS } from './auth.constants.js';
import { generateOpaqueToken, hashToken } from './token-crypto.js';

export interface IssuedRefreshToken {
  /** Valor bruto: vai apenas para o cookie httpOnly, nunca para o banco. */
  token: string;
  expiresAt: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Refresh tokens opacos com rotação e detecção de reutilização.
 *
 * - Cada login cria uma "família" (familyId) = uma sessão. Cada renovação revoga o
 *   token atual e emite um novo na mesma família.
 * - Se um token já rotacionado for apresentado de novo, alguém pode ter copiado o
 *   token: revogamos a família inteira, encerrando a sessão nos dois lados.
 * - Duas expirações: por inatividade (renovada a cada rotação) e absoluta (fixa
 *   desde o login), para que uma sessão não dure para sempre.
 */
@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Inicia uma nova sessão (nova família). */
  async issue(userId: string): Promise<IssuedRefreshToken> {
    const now = Date.now();
    const sessionExpiresAt = new Date(
      now + this.config.get('SESSION_ABSOLUTE_DAYS', { infer: true }) * DAY_MS,
    );
    const token = generateOpaqueToken();
    const expiresAt = this.idleExpiry(now, sessionExpiresAt);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        familyId: randomUUID(),
        tokenHash: hashToken(token),
        expiresAt,
        sessionExpiresAt,
      },
    });
    return { token, expiresAt };
  }

  /** Troca um refresh token válido por um novo. Retorna também o dono da sessão. */
  async rotate(rawToken: string): Promise<IssuedRefreshToken & { userId: string }> {
    const current = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
    });
    if (!current) {
      throw new UnauthorizedException('Sessão inválida');
    }

    if (current.revokedAt) {
      await this.handleRevokedTokenUse(current);
      throw new UnauthorizedException('Sessão inválida');
    }

    const now = Date.now();
    if (current.expiresAt.getTime() <= now) {
      throw new UnauthorizedException('Sessão expirada');
    }

    const next = {
      id: randomUUID(),
      token: generateOpaqueToken(),
      expiresAt: this.idleExpiry(now, current.sessionExpiresAt),
    };

    await this.prisma.$transaction(async (tx) => {
      // "Compare-and-set": só revoga se o token ainda estiver ativo. Se duas requisições
      // rotacionarem o mesmo token ao mesmo tempo, o PostgreSQL bloqueia a linha e
      // reavalia o WHERE: apenas uma atualiza (count === 1); a outra recebe 401.
      const claimed = await tx.refreshToken.updateMany({
        where: { id: current.id, revokedAt: null },
        data: {
          revokedAt: new Date(now),
          revokedReason: RefreshTokenRevocationReason.ROTATED,
          replacedById: next.id,
        },
      });
      if (claimed.count !== 1) {
        throw new UnauthorizedException('Sessão inválida');
      }

      await tx.refreshToken.create({
        data: {
          id: next.id,
          userId: current.userId,
          familyId: current.familyId,
          tokenHash: hashToken(next.token),
          expiresAt: next.expiresAt,
          sessionExpiresAt: current.sessionExpiresAt,
        },
      });
    });

    return { token: next.token, expiresAt: next.expiresAt, userId: current.userId };
  }

  /** Logout: encerra a sessão (família) à qual o token pertence. Idempotente. */
  async revokeSessionOf(rawToken: string): Promise<void> {
    const current = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      select: { familyId: true },
    });
    if (current) {
      await this.revokeFamily(current.familyId, RefreshTokenRevocationReason.LOGOUT);
    }
  }

  /**
   * Um token revogado foi reapresentado. Se ele foi rotacionado há pouco tempo,
   * tratamos como requisição concorrente legítima (ex.: duas abas renovando juntas)
   * e apenas recusamos. Fora dessa janela, é reutilização: revogamos a sessão.
   */
  private async handleRevokedTokenUse(token: {
    familyId: string;
    revokedAt: Date | null;
    revokedReason: RefreshTokenRevocationReason | null;
  }): Promise<void> {
    if (token.revokedReason !== RefreshTokenRevocationReason.ROTATED || !token.revokedAt) {
      return;
    }
    const rotatedRecently = Date.now() - token.revokedAt.getTime() < REFRESH_REUSE_GRACE_MS;
    if (rotatedRecently) {
      return;
    }
    await this.revokeFamily(token.familyId, RefreshTokenRevocationReason.REUSE_DETECTED);
    this.logger.warn(`Reutilização de refresh token detectada; sessão ${token.familyId} revogada`);
  }

  private async revokeFamily(familyId: string, reason: RefreshTokenRevocationReason) {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  private idleExpiry(now: number, sessionExpiresAt: Date): Date {
    const idle = now + this.config.get('REFRESH_TOKEN_IDLE_DAYS', { infer: true }) * DAY_MS;
    return new Date(Math.min(idle, sessionExpiresAt.getTime()));
  }
}
