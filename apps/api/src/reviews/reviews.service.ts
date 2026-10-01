import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CatalogService } from '../catalog/catalog.service.js';
import { pageArgs, toPage, type Page, type PaginationQueryDto } from '../common/pagination.js';
import { isRecordNotFoundError, isUniqueConstraintError } from '../prisma/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  normalizeComment,
  toReview,
  type CreateReviewDto,
  type ReviewDto,
  type UpdateReviewDto,
} from './dto/review.dto.js';
import { reviewSelect } from './review-select.js';

const REVIEW_NOT_FOUND = 'Você ainda não avaliou este jogo';

/**
 * A média e a quantidade de avaliações do jogo NÃO são calculadas aqui: uma trigger no
 * banco (`reviews_sync_game_rating`) aplica cada criação, edição ou exclusão aos
 * agregados do jogo, na mesma transação. O serviço só grava a avaliação.
 *
 * As rotas de escrita usam "/me": o usuário só consegue alterar a própria avaliação,
 * porque ela é localizada pelo par (userId do token, gameId).
 */
@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
  ) {}

  async listForGame(gameId: string, query: PaginationQueryDto): Promise<Page<ReviewDto>> {
    await this.catalog.assertGameExists(gameId);
    const where = { gameId };
    const [total, reviews] = await Promise.all([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...pageArgs(query),
        select: reviewSelect,
      }),
    ]);
    return toPage(reviews.map(toReview), total, query);
  }

  async create(userId: string, gameId: string, dto: CreateReviewDto): Promise<ReviewDto> {
    await this.catalog.assertGameExists(gameId);
    try {
      const review = await this.prisma.review.create({
        data: { userId, gameId, rating: dto.rating, comment: normalizeComment(dto.comment) },
        select: reviewSelect,
      });
      return toReview(review);
    } catch (error) {
      // UNIQUE (user_id, game_id): uma avaliação por usuário e jogo, mesmo em corrida.
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('Você já avaliou este jogo; edite a avaliação existente');
      }
      throw error;
    }
  }

  async getMine(userId: string, gameId: string): Promise<ReviewDto> {
    const review = await this.prisma.review.findUnique({
      where: { userId_gameId: { userId, gameId } },
      select: reviewSelect,
    });
    if (!review) {
      throw new NotFoundException(REVIEW_NOT_FOUND);
    }
    return toReview(review);
  }

  async updateMine(userId: string, gameId: string, dto: UpdateReviewDto): Promise<ReviewDto> {
    try {
      const review = await this.prisma.review.update({
        where: { userId_gameId: { userId, gameId } },
        data: { rating: dto.rating, comment: normalizeComment(dto.comment) },
        select: reviewSelect,
      });
      return toReview(review);
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        throw new NotFoundException(REVIEW_NOT_FOUND);
      }
      throw error;
    }
  }

  async deleteMine(userId: string, gameId: string): Promise<void> {
    const { count } = await this.prisma.review.deleteMany({ where: { userId, gameId } });
    if (count === 0) {
      throw new NotFoundException(REVIEW_NOT_FOUND);
    }
  }
}
