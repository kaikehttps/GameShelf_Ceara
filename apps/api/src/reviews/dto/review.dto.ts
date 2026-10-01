import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { PageMetaDto } from '../../common/pagination.js';
import { trim } from '../../common/transforms.js';
import { IsOptionalNotNull } from '../../common/validation.js';
import type { ReviewPayload } from '../review-select.js';

/** Mesmos limites do banco: CHECK rating BETWEEN 1 AND 5 e VARCHAR(1000). */
export const RATING_MIN = 1;
export const RATING_MAX = 5;
export const REVIEW_COMMENT_MAX_LENGTH = 1000;

const COMMENT_PROPERTY = {
  type: String,
  nullable: true,
  maxLength: REVIEW_COMMENT_MAX_LENGTH,
  example: 'Exploração excelente e trilha sonora marcante.',
  description: 'Texto vazio ou null remove o comentário.',
};

export class CreateReviewDto {
  @ApiProperty({ minimum: RATING_MIN, maximum: RATING_MAX, example: 5 })
  // Sem conversão implícita: "5" (texto) ou 4.5 respondem 400.
  @IsInt()
  @Min(RATING_MIN)
  @Max(RATING_MAX)
  rating!: number;

  @ApiPropertyOptional(COMMENT_PROPERTY)
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(REVIEW_COMMENT_MAX_LENGTH)
  comment?: string | null;
}

/** Na edição os dois campos são opcionais; a nota pode faltar, mas não pode ser null. */
export class UpdateReviewDto {
  @ApiPropertyOptional({ minimum: RATING_MIN, maximum: RATING_MAX, example: 4 })
  @IsOptionalNotNull()
  @IsInt()
  @Min(RATING_MIN)
  @Max(RATING_MAX)
  rating?: number;

  @ApiPropertyOptional(COMMENT_PROPERTY)
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(REVIEW_COMMENT_MAX_LENGTH)
  comment?: string | null;
}

export class ReviewAuthorDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Ana' })
  displayName!: string;
}

export class ReviewDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ minimum: RATING_MIN, maximum: RATING_MAX, example: 5 })
  rating!: number;

  @ApiProperty({ type: String, nullable: true })
  comment!: string | null;

  @ApiProperty({ type: ReviewAuthorDto })
  author!: ReviewAuthorDto;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class ReviewPageDto extends PageMetaDto {
  @ApiProperty({ type: [ReviewDto] })
  items!: ReviewDto[];
}

export function toReview(review: ReviewPayload): ReviewDto {
  return {
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    author: { id: review.user.id, displayName: review.user.displayName },
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
}

/** `undefined` mantém o comentário; texto vazio (após o trim) ou null o removem. */
export function normalizeComment(comment: string | null | undefined): string | null | undefined {
  return comment === undefined ? undefined : comment || null;
}
