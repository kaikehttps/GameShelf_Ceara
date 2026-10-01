import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { REFRESH_COOKIE_NAME } from './auth/auth.constants.js';
import type { Env } from './config/env.js';

/**
 * Configuração HTTP compartilhada entre o main.ts e os testes e2e, para que os
 * testes exercitem exatamente o mesmo pipeline de produção.
 */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const frontendOrigins = parseOrigins(config.get('CORS_ORIGINS', { infer: true }));

  // IP real do cliente atrás de proxy/load balancer (usado no rate limit).
  app.set('trust proxy', config.get('TRUST_PROXY_HOPS', { infer: true }));

  // Cabeçalhos de segurança equivalentes aos padrões do helmet 8 (nativo no Nest 12.1).
  app.useSecurityHeaders();

  // Proteção contra CSRF por Fetch Metadata (Sec-Fetch-Site) com fallback Origin/Host.
  // Recusa POST/PUT/PATCH/DELETE vindos de outro site, exceto das origens do frontend.
  app.enableCsrfProtection({ trustedOrigins: frontendOrigins });

  if (frontendOrigins.length > 0) {
    app.enableCors({ origin: frontendOrigins, credentials: true });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // remove campos sem decorator de validação
      forbidNonWhitelisted: true, // ...e responde 400 se eles forem enviados
      transform: true, // converte o payload para a classe do DTO
    }),
  );

  setupSwagger(app);
}

function setupSwagger(app: NestExpressApplication): void {
  const document = new DocumentBuilder()
    .setTitle('GameShelf API')
    .setDescription(
      'Catálogo, avaliações e biblioteca pessoal de jogos.\n\n' +
        'Fluxo: faça login em `POST /auth/login`, copie o `accessToken` e clique em **Authorize**. ' +
        `O refresh token fica no cookie httpOnly \`${REFRESH_COOKIE_NAME}\`, enviado pelo navegador.`,
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .addCookieAuth(REFRESH_COOKIE_NAME)
    .build();

  SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, document));
}

function parseOrigins(value: string): string[] {
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
