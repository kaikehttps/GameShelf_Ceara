import { Injectable, NotFoundException } from '@nestjs/common';
import { pageArgs, toPage, type Page } from '../common/pagination.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ListGamesQueryDto } from './dto/list-games-query.dto.js';
import {
  toGameDetail,
  toGameSummary,
  type GameDetailDto,
  type GameSummaryDto,
  type TaxonomyDto,
} from './dto/game-response.dto.js';
import { buildGameOrderBy, buildGameWhere } from './game-query.js';
import { gameDetailSelect, gameSummarySelect } from './game-select.js';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listGames(query: ListGamesQueryDto): Promise<Page<GameSummaryDto>> {
    const where = buildGameWhere(query);
    const [total, games] = await Promise.all([
      this.prisma.game.count({ where }),
      this.prisma.game.findMany({
        where,
        orderBy: buildGameOrderBy(query.sort, query.order),
        ...pageArgs(query),
        select: gameSummarySelect,
      }),
    ]);
    return toPage(games.map(toGameSummary), total, query);
  }

  async getGame(id: string): Promise<GameDetailDto> {
    const game = await this.prisma.game.findUnique({ where: { id }, select: gameDetailSelect });
    if (!game) {
      throw new NotFoundException('Jogo não encontrado');
    }
    return toGameDetail(game);
  }

  /** Usado pela biblioteca e pelas avaliações antes de gravar algo ligado a um jogo. */
  async assertGameExists(id: string): Promise<void> {
    const game = await this.prisma.game.findUnique({ where: { id }, select: { id: true } });
    if (!game) {
      throw new NotFoundException('Jogo não encontrado');
    }
  }

  listGenres(): Promise<TaxonomyDto[]> {
    return this.prisma.genre.findMany({
      select: { slug: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  listPlatforms(): Promise<TaxonomyDto[]> {
    return this.prisma.platform.findMany({
      select: { slug: true, name: true },
      orderBy: { name: 'asc' },
    });
  }
}
