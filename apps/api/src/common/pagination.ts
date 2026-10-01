import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;
/**
 * Paginação por OFFSET fica mais lenta quanto mais fundo se vai (o banco percorre e
 * descarta as linhas anteriores). O limite também impede valores absurdos que virariam
 * erro 500 no driver. Para chegar mais longe, use busca e filtros.
 */
export const MAX_PAGE = 1000;

/**
 * Query string chega como texto: `@Type(() => Number)` converte antes da validação.
 * Valores fora dos limites respondem 400, nunca são "corrigidos" em silêncio.
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: MAX_PAGE, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE)
  page: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_PAGE_SIZE, default: DEFAULT_PAGE_SIZE })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize: number = DEFAULT_PAGE_SIZE;
}

/** Metadados comuns às respostas paginadas. Cada recurso estende com seu `items`. */
export class PageMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 42, description: 'Total de itens que atendem aos filtros.' })
  total!: number;

  @ApiProperty({ example: 3 })
  totalPages!: number;
}

export interface Page<T> extends PageMetaDto {
  items: T[];
}

/** Converte página/tamanho em `skip`/`take` do Prisma. */
export function pageArgs({ page, pageSize }: PaginationQueryDto): { skip: number; take: number } {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function toPage<T>(
  items: T[],
  total: number,
  { page, pageSize }: PaginationQueryDto,
): Page<T> {
  return { items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}
