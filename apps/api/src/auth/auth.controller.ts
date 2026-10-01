import { Body, Controller, Cookies, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Response } from 'express';
import type { Env } from '../config/env.js';
import { toUserResponse } from '../users/dto/user-response.dto.js';
import { AuthService, type AuthSession } from './auth.service.js';
import { AUTH_RATE_LIMIT, REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH } from './auth.constants.js';
import { AuthResponseDto, LoginDto, RegisterDto } from './dto/auth.dto.js';
import { Public } from './public.decorator.js';

@ApiTags('auth')
@ApiTooManyRequestsResponse({ description: 'Limite de tentativas excedido.' })
@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Post('register')
  @Throttle({ default: AUTH_RATE_LIMIT.register })
  @ApiOperation({ summary: 'Cria a conta e já inicia uma sessão' })
  @ApiCreatedResponse({ type: AuthResponseDto })
  @ApiConflictResponse({ description: 'E-mail já cadastrado.' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    return this.respondWithSession(res, await this.auth.register(dto));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: AUTH_RATE_LIMIT.login })
  @ApiOperation({ summary: 'Autentica com e-mail e senha' })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'E-mail ou senha inválidos.' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    return this.respondWithSession(res, await this.auth.login(dto));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: AUTH_RATE_LIMIT.refresh })
  @ApiCookieAuth(REFRESH_COOKIE_NAME)
  @ApiOperation({
    summary: 'Troca o refresh token (cookie) por um novo par de tokens',
    description:
      'O refresh token antigo é revogado. Reapresentar um token já usado revoga a sessão inteira.',
  })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Refresh token ausente, expirado, revogado ou reutilizado.',
  })
  async refresh(
    @Cookies(REFRESH_COOKIE_NAME) refreshToken: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    try {
      return this.respondWithSession(res, await this.auth.refresh(refreshToken));
    } catch (error) {
      res.clearCookie(REFRESH_COOKIE_NAME, this.cookieOptions());
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth(REFRESH_COOKIE_NAME)
  @ApiOperation({ summary: 'Encerra a sessão atual (revoga a família do refresh token)' })
  @ApiNoContentResponse()
  async logout(
    @Cookies(REFRESH_COOKIE_NAME) refreshToken: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(refreshToken);
    res.clearCookie(REFRESH_COOKIE_NAME, this.cookieOptions());
  }

  private respondWithSession(res: Response, session: AuthSession): AuthResponseDto {
    res.cookie(REFRESH_COOKIE_NAME, session.refreshToken.token, {
      ...this.cookieOptions(),
      expires: session.refreshToken.expiresAt,
    });
    return {
      accessToken: session.accessToken,
      tokenType: 'Bearer',
      expiresIn: session.expiresIn,
      user: toUserResponse(session.user),
    };
  }

  /**
   * httpOnly: JavaScript do navegador não lê o cookie (mitiga roubo via XSS).
   * sameSite=strict: o navegador não envia o cookie em requisições de outros sites (CSRF).
   * path: o cookie só trafega nas rotas /auth, não em toda requisição.
   */
  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.get('COOKIE_SECURE', { infer: true }),
      sameSite: 'strict',
      path: REFRESH_COOKIE_PATH,
    };
  }
}
