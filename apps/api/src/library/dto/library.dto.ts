import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { GameSummaryDto, toGameSummary } from '../../catalog/dto/game-response.dto.js';
import { MAX_PAGE_SIZE, PageMetaDto, PaginationQueryDto } from '../../common/pagination.js';
import { IsOptionalNotNull } from '../../common/validation.js';
import { LibraryStatus } from '../../generated/prisma/client.js';
import type { LibraryEntryPayload } from '../library-entry-select.js';

const STATUS_DESCRIPTION =
  'WANT_TO_PLAY = quero jogar, PLAYING = jogando, COMPLETED = finalizado, ABANDONED = abandonado.';

export class LibraryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: LibraryStatus, enumName: 'LibraryStatus' })
  @IsOptional()
  @IsEnum(LibraryStatus)
  status?: LibraryStatus;
}

/** Ids separados por vírgula: `?gameIds=id1,id2`. No máximo uma página do catálogo. */
export class LibraryStatusQueryDto {
  @ApiProperty({
    type: String,
    description: `Até ${MAX_PAGE_SIZE} ids de jogos, separados por vírgula.`,
    example: '0199a0b2-7f3c-7a1e-9c4d-1234567890ab,0199a0b2-7f3c-7a1e-9c4d-1234567890ac',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.split(',').map((id) => id.trim()) : value,
  )
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_PAGE_SIZE)
  @IsUUID('all', { each: true })
  gameIds!: string[];
}

export class LibraryGameStatusDto {
  @ApiProperty({ format: 'uuid' })
  gameId!: string;

  @ApiProperty({ enum: LibraryStatus, enumName: 'LibraryStatus' })
  status!: LibraryStatus;
}

export class AddToLibraryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  gameId!: string;

  @ApiPropertyOptional({
    enum: LibraryStatus,
    enumName: 'LibraryStatus',
    default: LibraryStatus.WANT_TO_PLAY,
    description: STATUS_DESCRIPTION,
  })
  @IsOptionalNotNull()
  @IsEnum(LibraryStatus)
  status: LibraryStatus = LibraryStatus.WANT_TO_PLAY;
}

export class UpdateLibraryEntryDto {
  @ApiProperty({ enum: LibraryStatus, enumName: 'LibraryStatus', description: STATUS_DESCRIPTION })
  @IsEnum(LibraryStatus)
  status!: LibraryStatus;
}

export class LibraryEntryDto {
  @ApiProperty({ type: GameSummaryDto })
  game!: GameSummaryDto;

  @ApiProperty({ enum: LibraryStatus, enumName: 'LibraryStatus' })
  status!: LibraryStatus;

  @ApiProperty({ description: 'Quando o jogo entrou na biblioteca.' })
  addedAt!: Date;

  @ApiProperty({ description: 'Última mudança de status.' })
  updatedAt!: Date;
}

export class LibraryPageDto extends PageMetaDto {
  @ApiProperty({ type: [LibraryEntryDto] })
  items!: LibraryEntryDto[];
}

export function toLibraryEntry(entry: LibraryEntryPayload): LibraryEntryDto {
  return {
    game: toGameSummary(entry.game),
    status: entry.status,
    addedAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}
