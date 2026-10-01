import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * - liveness: o processo está de pé? (não consulta dependências, para o orquestrador
 *   não reiniciar a API só porque o banco caiu)
 * - readiness: a API consegue atender? (consulta as dependências obrigatórias)
 */
@ApiTags('health')
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('live')
  @ApiOperation({ summary: 'Liveness: o processo está respondendo' })
  @ApiOkResponse({ schema: { example: { status: 'ok' } } })
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness: dependências obrigatórias disponíveis' })
  @ApiOkResponse({ schema: { example: { status: 'ok', checks: { database: 'up' } } } })
  @ApiServiceUnavailableResponse({
    description: 'Alguma dependência obrigatória está indisponível.',
  })
  async ready() {
    const database = (await this.prisma.isHealthy()) ? 'up' : 'down';
    const body = { status: database === 'up' ? 'ok' : 'unavailable', checks: { database } };
    if (database === 'down') {
      throw new ServiceUnavailableException(body);
    }
    return body;
  }
}
