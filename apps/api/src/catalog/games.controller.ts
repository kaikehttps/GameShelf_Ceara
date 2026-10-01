import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../auth/public.decorator.js';
import { MAX_PAGE_SIZE } from '../common/pagination.js';
import { CatalogService } from './catalog.service.js';
import { GameDetailDto, GamePageDto } from './dto/game-response.dto.js';
import { ListGamesQueryDto } from './dto/list-games-query.dto.js';

@ApiTags('catalog')
@Public()
@Controller('games')
export class GamesController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista o catálogo com busca, filtros, ordenação e paginação',
    description: `No máximo ${MAX_PAGE_SIZE} itens por página. Sem \`sort\`, ordena por nome.`,
  })
  @ApiOkResponse({ type: GamePageDto })
  @ApiBadRequestResponse({ description: 'Parâmetro inválido ou desconhecido.' })
  list(@Query() query: ListGamesQueryDto): Promise<GamePageDto> {
    return this.catalog.listGames(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhes de um jogo' })
  @ApiOkResponse({ type: GameDetailDto })
  @ApiBadRequestResponse({ description: 'O id não é um UUID.' })
  @ApiNotFoundResponse({ description: 'Jogo não encontrado.' })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<GameDetailDto> {
    return this.catalog.getGame(id);
  }
}
