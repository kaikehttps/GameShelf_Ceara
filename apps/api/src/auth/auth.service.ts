import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Env } from '../config/env.js';
import { isUniqueConstraintError } from '../prisma/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { publicUserSelect, type PublicUser } from '../users/public-user.js';
import type { AccessTokenPayload } from './auth.types.js';
import type { LoginDto, RegisterDto } from './dto/auth.dto.js';
import { PasswordHasher } from './password-hasher.js';
import { RefreshTokenService, type IssuedRefreshToken } from './refresh-token.service.js';

export interface AuthSession {
  user: PublicUser;
  accessToken: string;
  expiresIn: number;
  refreshToken: IssuedRefreshToken;
}

const INVALID_CREDENTIALS = 'E-mail ou senha inválidos';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordHasher,
    private readonly refreshTokens: RefreshTokenService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async register(dto: RegisterDto): Promise<AuthSession> {
    const passwordHash = await this.passwords.hash(dto.password);
    try {
      const user = await this.prisma.user.create({
        data: { email: dto.email, displayName: dto.displayName, passwordHash },
        select: publicUserSelect,
      });
      return this.startSession(user);
    } catch (error) {
      // A restrição UNIQUE do banco é a garantia final contra e-mails duplicados,
      // inclusive em cadastros simultâneos.
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('E-mail já cadastrado');
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthSession> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { ...publicUserSelect, passwordHash: true },
    });

    // Mesmo sem usuário, verificamos contra um hash fictício para que o tempo de
    // resposta não revele quais e-mails estão cadastrados.
    const passwordMatches = await this.passwords.verify(
      user?.passwordHash ?? (await this.passwords.dummyHash()),
      dto.password,
    );

    if (!user || !passwordMatches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const { passwordHash: _passwordHash, ...publicUser } = user;
    return this.startSession(publicUser);
  }

  async refresh(rawRefreshToken: string | undefined): Promise<AuthSession> {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Sessão inválida');
    }
    const rotated = await this.refreshTokens.rotate(rawRefreshToken);
    const user = await this.prisma.user.findUnique({
      where: { id: rotated.userId },
      select: publicUserSelect,
    });
    if (!user) {
      throw new UnauthorizedException('Sessão inválida');
    }
    return {
      user,
      ...(await this.signAccessToken(user.id)),
      refreshToken: { token: rotated.token, expiresAt: rotated.expiresAt },
    };
  }

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (rawRefreshToken) {
      await this.refreshTokens.revokeSessionOf(rawRefreshToken);
    }
  }

  private async startSession(user: PublicUser): Promise<AuthSession> {
    return {
      user,
      ...(await this.signAccessToken(user.id)),
      refreshToken: await this.refreshTokens.issue(user.id),
    };
  }

  private async signAccessToken(userId: string) {
    const payload: AccessTokenPayload = { sub: userId };
    return {
      accessToken: await this.jwt.signAsync(payload),
      expiresIn: this.config.get('JWT_ACCESS_TTL_SECONDS', { infer: true }),
    };
  }
}
