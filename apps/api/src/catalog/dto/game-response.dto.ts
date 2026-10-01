import { ApiProperty } from '@nestjs/swagger';
import { PageMetaDto } from '../../common/pagination.js';
import { CatalogProvider } from '../../generated/prisma/client.js';
import type { GameDetail, GameSummary } from '../game-select.js';

/** Gênero ou plataforma. */
export class TaxonomyDto {
  @ApiProperty({ example: 'rpg' })
  slug!: string;

  @ApiProperty({ example: 'RPG' })
  name!: string;
}

export class RatingSummaryDto {
  @ApiProperty({
    type: Number,
    nullable: true,
    example: 4.33,
    description: 'Média de 1 a 5 com duas casas decimais; null enquanto não houver avaliações.',
  })
  average!: number | null;

  @ApiProperty({ example: 3 })
  count!: number;
}

export class GameSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Hollow Knight' })
  name!: string;

  @ApiProperty({ type: String, nullable: true, format: 'uri', description: 'Capa vertical (3:4).' })
  coverUrl!: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'uri', description: 'Imagem larga.' })
  bannerUrl!: string | null;

  @ApiProperty({
    enum: CatalogProvider,
    enumName: 'CatalogProvider',
    isArray: true,
    description: 'Lojas/provedores em que o jogo foi identificado.',
  })
  stores!: CatalogProvider[];

  @ApiProperty({ type: String, nullable: true, format: 'date', example: '2017-02-24' })
  releaseDate!: string | null;

  @ApiProperty({ type: [TaxonomyDto] })
  genres!: TaxonomyDto[];

  @ApiProperty({ type: [TaxonomyDto] })
  platforms!: TaxonomyDto[];

  @ApiProperty({ type: RatingSummaryDto })
  rating!: RatingSummaryDto;
}

export class ExternalIdDto {
  @ApiProperty({ enum: CatalogProvider, enumName: 'CatalogProvider' })
  provider!: CatalogProvider;

  @ApiProperty({ example: '367520', description: 'Identificador do jogo no provedor.' })
  externalId!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    format: 'uri',
    example: 'https://store.steampowered.com/app/367520',
    description: 'Página oficial do jogo na loja, quando o formato da URL é conhecido.',
  })
  storeUrl!: string | null;
}

/**
 * Só montamos URLs de formato público e estável. Para Epic e LaunchBox a URL depende
 * de dados que a sincronização (etapa 3) ainda vai trazer, então fica null.
 */
export function storeUrlFor(provider: CatalogProvider, externalId: string): string | null {
  switch (provider) {
    case CatalogProvider.STEAM:
      return `https://store.steampowered.com/app/${encodeURIComponent(externalId)}`;
    default:
      return null;
  }
}

export class GameDetailDto extends GameSummaryDto {
  @ApiProperty({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ type: [ExternalIdDto] })
  externalIds!: ExternalIdDto[];

  @ApiProperty()
  updatedAt!: Date;
}

export class GamePageDto extends PageMetaDto {
  @ApiProperty({ type: [GameSummaryDto] })
  items!: GameSummaryDto[];
}

export function toGameSummary(game: GameSummary): GameSummaryDto {
  return {
    id: game.id,
    name: game.name,
    coverUrl: game.coverUrl,
    bannerUrl: game.bannerUrl,
    stores: game.externalIds.map(({ provider }) => provider),
    // Coluna DATE: o Prisma devolve meia-noite UTC; a API expõe só "AAAA-MM-DD".
    releaseDate: game.releaseDate?.toISOString().slice(0, 10) ?? null,
    genres: game.genres.map(({ genre }) => ({ slug: genre.slug, name: genre.name })),
    platforms: game.platforms.map(({ platform }) => ({ slug: platform.slug, name: platform.name })),
    rating: {
      // DECIMAL(3,2) chega como Prisma.Decimal; no JSON vira número (ex.: 4.33).
      average: game.ratingAverage?.toNumber() ?? null,
      count: game.ratingCount,
    },
  };
}

export function toGameDetail(game: GameDetail): GameDetailDto {
  return {
    ...toGameSummary(game),
    description: game.description,
    externalIds: game.externalIds.map(({ provider, externalId }) => ({
      provider,
      externalId,
      storeUrl: storeUrlFor(provider, externalId),
    })),
    updatedAt: game.updatedAt,
  };
}
