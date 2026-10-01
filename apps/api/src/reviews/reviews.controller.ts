import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
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
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { Public } from '../auth/public.decorator.js';
import { PaginationQueryDto } from '../common/pagination.js';
import { CreateReviewDto, ReviewDto, ReviewPageDto, UpdateReviewDto } from './dto/review.dto.js';
import { ReviewsService } from './reviews.service.js';

const UNAUTHORIZED = 'Access token ausente, inválido ou expirado.';

@ApiTags('reviews')
@Controller('games/:gameId/reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Avaliações de um jogo, das mais recentes às mais antigas' })
  @ApiOkResponse({ type: ReviewPageDto })
  @ApiNotFoundResponse({ description: 'Jogo não encontrado.' })
  list(
    @Param('gameId', ParseUUIDPipe) gameId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<ReviewPageDto> {
    return this.reviews.listForGame(gameId, query);
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Avalia o jogo (uma avaliação por usuário)' })
  @ApiCreatedResponse({ type: ReviewDto })
  @ApiBadRequestResponse({ description: 'Nota fora de 1–5, não inteira, ou comentário longo.' })
  @ApiUnauthorizedResponse({ description: UNAUTHORIZED })
  @ApiNotFoundResponse({ description: 'Jogo não encontrado.' })
  @ApiConflictResponse({ description: 'Você já avaliou este jogo.' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('gameId', ParseUUIDPipe) gameId: string,
    @Body() dto: CreateReviewDto,
  ): Promise<ReviewDto> {
    return this.reviews.create(user.id, gameId, dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'A sua avaliação deste jogo' })
  @ApiOkResponse({ type: ReviewDto })
  @ApiUnauthorizedResponse({ description: UNAUTHORIZED })
  @ApiNotFoundResponse({ description: 'Você ainda não avaliou este jogo.' })
  getMine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('gameId', ParseUUIDPipe) gameId: string,
  ): Promise<ReviewDto> {
    return this.reviews.getMine(user.id, gameId);
  }

  @Patch('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edita a sua avaliação deste jogo' })
  @ApiOkResponse({ type: ReviewDto })
  @ApiBadRequestResponse({ description: 'Nota fora de 1–5, não inteira, ou comentário longo.' })
  @ApiUnauthorizedResponse({ description: UNAUTHORIZED })
  @ApiNotFoundResponse({ description: 'Você ainda não avaliou este jogo.' })
  updateMine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('gameId', ParseUUIDPipe) gameId: string,
    @Body() dto: UpdateReviewDto,
  ): Promise<ReviewDto> {
    return this.reviews.updateMine(user.id, gameId, dto);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Exclui a sua avaliação deste jogo' })
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ description: UNAUTHORIZED })
  @ApiNotFoundResponse({ description: 'Você ainda não avaliou este jogo.' })
  async deleteMine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('gameId', ParseUUIDPipe) gameId: string,
  ): Promise<void> {
    await this.reviews.deleteMine(user.id, gameId);
  }
}
