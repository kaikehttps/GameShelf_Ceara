import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { validateEnv } from './config/env.js';
import { DownloadsModule } from './downloads/downloads.module.js';
import { HealthModule } from './health/health.module.js';
import { LibraryModule } from './library/library.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ReviewsModule } from './reviews/reviews.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Variáveis já definidas no ambiente (Docker, CI) têm prioridade sobre os arquivos.
      envFilePath: ['.env', '../../.env'],
      validate: validateEnv,
    }),
    // Limite global por IP. Rotas de autenticação definem limites mais rígidos.
    ThrottlerModule.forRoot({ throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }] }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CatalogModule,
    LibraryModule,
    ReviewsModule,
    DownloadsModule,
    HealthModule,
  ],
  providers: [
    // A ordem importa: primeiro o rate limit, depois a autenticação.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
