import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.js';
import { trim, trimLowercase } from '../../common/transforms.js';
import { GameSort, SEARCH_MAX_LENGTH, SortOrder } from '../game-query.js';

/** Mesmo formato garantido pelo CHECK das tabelas genres e platforms. */
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export class ListGamesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Palavras do nome do jogo. Todas precisam aparecer, em qualquer ordem.',
    example: 'hollow knight',
    maxLength: SEARCH_MAX_LENGTH,
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(SEARCH_MAX_LENGTH)
  q?: string;

  @ApiPropertyOptional({ description: 'Slug do gênero (veja GET /genres).', example: 'rpg' })
  @IsOptional()
  @Transform(trimLowercase)
  @IsString()
  @Matches(SLUG_PATTERN, { message: 'genre deve ser um slug, como "rpg"' })
  genre?: string;

  @ApiPropertyOptional({
    description: 'Slug da plataforma (veja GET /platforms).',
    example: 'linux',
  })
  @IsOptional()
  @Transform(trimLowercase)
  @IsString()
  @Matches(SLUG_PATTERN, { message: 'platform deve ser um slug, como "windows"' })
  platform?: string;

  @ApiPropertyOptional({ enum: GameSort, enumName: 'GameSort', default: GameSort.NAME })
  @IsOptional()
  @IsEnum(GameSort)
  sort: GameSort = GameSort.NAME;

  @ApiPropertyOptional({
    enum: SortOrder,
    enumName: 'SortOrder',
    description: 'Padrão: `asc` para `name`; `desc` para os demais critérios.',
  })
  @IsOptional()
  @IsEnum(SortOrder)
  order?: SortOrder;
}
