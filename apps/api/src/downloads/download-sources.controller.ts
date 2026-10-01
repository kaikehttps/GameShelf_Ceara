import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator.js';
import { DownloadsService } from './downloads.service.js';
import { DownloadSourceDto } from './dto/download.dto.js';

@ApiTags('downloads')
@Public()
@Controller('games/:gameId/download-sources')
export class DownloadSourcesController {
  constructor(private readonly downloads: DownloadsService) {}

  @Get()
  @ApiOperation({
    summary: 'Fontes de download ativas de um jogo',
    description:
      'Só conteúdos de distribuição autorizada, cadastrados por um administrador. O link ' +
      'magnet e o .torrent não saem na resposta: o download começa pelo id da fonte.',
  })
  @ApiOkResponse({ type: [DownloadSourceDto] })
  list(@Param('gameId', ParseUUIDPipe) gameId: string): Promise<DownloadSourceDto[]> {
    return this.downloads.listSources(gameId);
  }
}
