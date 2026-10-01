import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator.js';
import { CatalogService } from './catalog.service.js';
import { TaxonomyDto } from './dto/game-response.dto.js';

/** Valores aceitos pelos filtros `genre` e `platform` de GET /games. */
@ApiTags('catalog')
@Public()
@Controller()
export class CatalogFiltersController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('genres')
  @ApiOperation({ summary: 'Gêneros disponíveis para filtrar o catálogo' })
  @ApiOkResponse({ type: [TaxonomyDto] })
  genres(): Promise<TaxonomyDto[]> {
    return this.catalog.listGenres();
  }

  @Get('platforms')
  @ApiOperation({ summary: 'Plataformas disponíveis para filtrar o catálogo' })
  @ApiOkResponse({ type: [TaxonomyDto] })
  platforms(): Promise<TaxonomyDto[]> {
    return this.catalog.listPlatforms();
  }
}
