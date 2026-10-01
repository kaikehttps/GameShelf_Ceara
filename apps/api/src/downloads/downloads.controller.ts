import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  type MessageEvent,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Sse,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Observable } from 'rxjs';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { DownloadsService } from './downloads.service.js';
import {
  ClientStatusDto,
  DeleteFilesDto,
  DownloadDto,
  DownloadPageDto,
  ListDownloadsQueryDto,
  StartDownloadDto,
  toProgressEvent,
} from './dto/download.dto.js';
import { LiveState } from './live/live-state.js';

const ONE_MINUTE_MS = 60_000;
const HEARTBEAT_MS = 15_000;
const UNAVAILABLE = 'Cliente torrent indisponível ou downloads desativados neste ambiente.';

/**
 * Downloads do usuário autenticado. Os arquivos vão para a pasta de downloads da máquina
 * que executa o ambiente (volume do Docker), não para o navegador de quem clicou.
 */
@ApiTags('downloads')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Access token ausente, inválido ou expirado.' })
@Controller('downloads')
export class DownloadsController {
  constructor(
    private readonly downloads: DownloadsService,
    private readonly live: LiveState,
  ) {}

  // Rotas fixas antes de ':id' (o Express casa na ordem de declaração).

  @Get('client-status')
  @ApiOperation({ summary: 'O cliente torrent está disponível?' })
  @ApiOkResponse({ type: ClientStatusDto })
  clientStatus(): Promise<ClientStatusDto> {
    return this.downloads.clientStatus();
  }

  @Sse('events')
  @ApiOperation({
    summary: 'Progresso em tempo real (Server-Sent Events)',
    description:
      'Autentique com `Authorization: Bearer` (o token nunca vai na URL; por isso o frontend lê ' +
      'o stream com fetch, e não com EventSource). Eventos: `download` (progresso de um ' +
      'download seu), `client` (disponibilidade do cliente torrent) e `ping` a cada 15 s.',
  })
  @ApiProduces('text/event-stream')
  @ApiOkResponse({ description: 'Stream de eventos.' })
  events(@CurrentUser() user: AuthenticatedUser): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      let closed = false;
      const unsubscribe = this.live.subscribe((event) => {
        if (event.type === 'client') {
          subscriber.next({ type: 'client', data: event.status });
        } else if (event.snapshot.userId === user.id) {
          // Cada conexão só recebe os downloads do próprio usuário.
          subscriber.next({ type: 'download', data: toProgressEvent(event.snapshot) });
        }
      });
      this.downloads
        .initialEvents(user.id)
        .then((events) => events.forEach((event) => !closed && subscriber.next(event)))
        .catch((error: Error) => subscriber.error(error));
      // Comentário periódico: mantém a conexão viva em proxies que cortam conexões ociosas.
      const heartbeat = setInterval(
        () => subscriber.next({ type: 'ping', data: {} }),
        HEARTBEAT_MS,
      );
      // Navegador desconectou: libera a inscrição e o timer.
      return () => {
        closed = true;
        unsubscribe();
        clearInterval(heartbeat);
      };
    });
  }

  @Get()
  @ApiOperation({ summary: 'Lista os seus downloads, dos mais recentes aos mais antigos' })
  @ApiOkResponse({ type: DownloadPageDto })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListDownloadsQueryDto,
  ): Promise<DownloadPageDto> {
    return this.downloads.list(user.id, query);
  }

  @Post()
  @Throttle({ default: { limit: 10, ttl: ONE_MINUTE_MS } })
  @ApiOperation({
    summary: 'Inicia o download de uma fonte cadastrada',
    description:
      'Só aceita o id de uma fonte cadastrada por um administrador; links e caminhos não ' +
      'são aceitos. O arquivo vai para a máquina que executa o ambiente.',
  })
  @ApiCreatedResponse({ type: DownloadDto })
  @ApiNotFoundResponse({ description: 'Fonte inexistente ou desativada.' })
  @ApiConflictResponse({ description: 'O torrent já está em uso por outro download ativo.' })
  @ApiServiceUnavailableResponse({ description: UNAVAILABLE })
  start(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: StartDownloadDto,
  ): Promise<DownloadDto> {
    return this.downloads.start(user.id, dto.sourceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhes de um download seu' })
  @ApiOkResponse({ type: DownloadDto })
  @ApiNotFoundResponse({ description: 'Download inexistente ou de outro usuário.' })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DownloadDto> {
    return this.downloads.get(user.id, id);
  }

  @Post(':id/pause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pausa (repetir não é erro)' })
  @ApiOkResponse({ type: DownloadDto })
  @ApiConflictResponse({ description: 'O estado atual não permite pausar.' })
  @ApiServiceUnavailableResponse({ description: UNAVAILABLE })
  pause(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DownloadDto> {
    return this.downloads.pause(user.id, id);
  }

  @Post(':id/resume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retoma um download pausado (repetir não é erro)' })
  @ApiOkResponse({ type: DownloadDto })
  @ApiConflictResponse({ description: 'O estado atual não permite retomar.' })
  @ApiServiceUnavailableResponse({ description: UNAVAILABLE })
  resume(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DownloadDto> {
    return this.downloads.resume(user.id, id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancela: remove a tarefa do cliente torrent e preserva os arquivos',
    description: 'Para apagar os arquivos, use depois POST /downloads/{id}/delete-files.',
  })
  @ApiOkResponse({ type: DownloadDto })
  @ApiServiceUnavailableResponse({ description: UNAVAILABLE })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DownloadDto> {
    return this.downloads.cancel(user.id, id);
  }

  @Post(':id/delete-files')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Exclui os arquivos de um download cancelado (exige {"confirm": true})',
    description: 'Apaga somente a pasta deste download dentro do volume de downloads.',
  })
  @ApiNoContentResponse()
  @ApiBadRequestResponse({ description: 'Sem a confirmação explícita.' })
  @ApiConflictResponse({ description: 'O download ainda não foi cancelado.' })
  @ApiServiceUnavailableResponse({ description: 'DOWNLOADS_DIR não configurada na API.' })
  async deleteFiles(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() _dto: DeleteFilesDto,
  ): Promise<void> {
    await this.downloads.deleteFiles(user.id, id);
  }
}
