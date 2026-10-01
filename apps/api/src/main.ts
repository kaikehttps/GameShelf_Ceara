import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import type { Env } from './config/env.js';

const app = await NestFactory.create<NestExpressApplication>(AppModule);
configureApp(app);

// Fecha conexões (banco, filas) de forma ordenada ao receber SIGTERM/SIGINT.
app.enableShutdownHooks();

const port = app.get<ConfigService<Env, true>>(ConfigService).get('PORT', { infer: true });
await app.listen(port);
Logger.log(
  `API em http://localhost:${port} | Swagger em http://localhost:${port}/docs`,
  'Bootstrap',
);
