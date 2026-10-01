import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Equals, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PageMetaDto, PaginationQueryDto } from '../../common/pagination.js';
import { DownloadSourceKind, DownloadStatus } from '../../generated/prisma/client.js';
import type { ClientStatus, DownloadSnapshot } from '../live/live-state.js';
import type { DownloadRecord, PublicSource } from '../download-select.js';

export const DOWNLOAD_ACTIONS = ['pause', 'resume', 'cancel', 'deleteFiles'] as const;
export type DownloadAction = (typeof DOWNLOAD_ACTIONS)[number];

const STATUS_DESCRIPTION =
  'QUEUED = na fila, METADATA = buscando metadados, DOWNLOADING = baixando, PAUSED = pausado, ' +
  'CHECKING = verificando, COMPLETED = concluído, CANCELED = cancelado, ERROR = erro.';

export class StartDownloadDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Fonte cadastrada (GET /games/{id}/download-sources).',
  })
  @IsUUID()
  sourceId!: string;
}

export class DeleteFilesDto {
  @ApiProperty({
    example: true,
    description: 'Confirmação explícita: apaga a pasta deste download no disco. Não tem volta.',
  })
  @Equals(true, { message: 'confirme a exclusão enviando {"confirm": true}' })
  confirm!: true;
}

export class ListDownloadsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: DownloadStatus, enumName: 'DownloadStatus' })
  @IsOptional()
  @IsEnum(DownloadStatus)
  status?: DownloadStatus;
}

export class DownloadSourceDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Arquivo de teste do GameShelf (8 MiB)' })
  name!: string;

  @ApiProperty({ enum: DownloadSourceKind, enumName: 'DownloadSourceKind' })
  kind!: DownloadSourceKind;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Tamanho total em bytes, quando conhecido.',
  })
  sizeBytes!: number | null;

  @ApiProperty({ example: 'Gerado pelo GameShelf para a demonstração' })
  origin!: string;

  @ApiProperty({ example: 'Conteúdo próprio, distribuição livre' })
  license!: string;

  @ApiProperty({ type: String, nullable: true })
  authorizationNote!: string | null;
}

export class DownloadGameDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: String, nullable: true })
  coverUrl!: string | null;
}

export class DownloadDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    enum: DownloadStatus,
    enumName: 'DownloadStatus',
    description: STATUS_DESCRIPTION,
  })
  status!: DownloadStatus;

  @ApiProperty({ example: 0.42, description: 'De 0 a 1.' })
  progress!: number;

  @ApiProperty({ example: 3523215 })
  downloadedBytes!: number;

  @ApiProperty({ type: Number, nullable: true })
  totalBytes!: number | null;

  @ApiProperty({ description: 'bytes/s; 0 quando não há dados em tempo real.' })
  downloadSpeed!: number;

  @ApiProperty({ description: 'bytes/s' })
  uploadSpeed!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Segundos restantes; null quando não há estimativa ("Calculando…").',
  })
  etaSeconds!: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Peers conectados; null sem dados em tempo real.',
  })
  peers!: number | null;

  @ApiProperty({ description: 'Baixando, mas sem peers disponíveis no momento (não é erro).' })
  stalled!: boolean;

  @ApiProperty({ description: 'Concluído e ainda compartilhando (seeding).' })
  seeding!: boolean;

  @ApiProperty({ type: String, nullable: true })
  lastError!: string | null;

  @ApiProperty({
    enum: DOWNLOAD_ACTIONS,
    isArray: true,
    description: 'Ações permitidas no estado atual.',
  })
  allowedActions!: DownloadAction[];

  @ApiProperty({ description: 'true depois que os arquivos foram excluídos.' })
  filesDeleted!: boolean;

  @ApiProperty({
    example: '0199a0b2-7f3c-7a1e-9c4d-1234567890ab/',
    description: 'Pasta do download dentro do volume de downloads da máquina que roda o ambiente.',
  })
  folder!: string;

  @ApiProperty({ type: DownloadGameDto })
  game!: DownloadGameDto;

  @ApiProperty({ type: () => DownloadSourceSummaryDto })
  source!: DownloadSourceSummaryDto;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ type: Date, nullable: true })
  completedAt!: Date | null;
}

export class DownloadSourceSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  license!: string;
}

export class DownloadPageDto extends PageMetaDto {
  @ApiProperty({ type: [DownloadDto] })
  items!: DownloadDto[];
}

export class ClientStatusDto {
  @ApiProperty({ description: 'false quando a API foi iniciada sem QBT_URL.' })
  enabled!: boolean;

  @ApiProperty({ description: 'O cliente torrent respondeu na última verificação.' })
  available!: boolean;

  @ApiProperty({ type: String, nullable: true })
  message!: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  checkedAt!: string | null;
}

/** Evento do canal de progresso (SSE). */
export class DownloadProgressEventDto {
  @ApiProperty({ format: 'uuid' })
  downloadId!: string;

  @ApiProperty({ enum: DownloadStatus, enumName: 'DownloadStatus' })
  status!: DownloadStatus;

  @ApiProperty()
  progress!: number;

  @ApiProperty()
  downloadedBytes!: number;

  @ApiProperty({ type: Number, nullable: true })
  totalBytes!: number | null;

  @ApiProperty()
  downloadSpeed!: number;

  @ApiProperty()
  uploadSpeed!: number;

  @ApiProperty({ type: Number, nullable: true })
  etaSeconds!: number | null;

  @ApiProperty()
  peers!: number;

  @ApiProperty()
  stalled!: boolean;

  @ApiProperty()
  seeding!: boolean;

  @ApiProperty({ type: String, nullable: true })
  lastError!: string | null;
}

export function allowedActions(
  download: Pick<DownloadRecord, 'status' | 'filesDeletedAt'>,
): DownloadAction[] {
  switch (download.status) {
    case DownloadStatus.QUEUED:
    case DownloadStatus.METADATA:
    case DownloadStatus.DOWNLOADING:
    case DownloadStatus.CHECKING:
      return ['pause', 'cancel'];
    case DownloadStatus.PAUSED:
      return ['resume', 'cancel'];
    case DownloadStatus.COMPLETED:
    case DownloadStatus.ERROR:
      return ['cancel'];
    case DownloadStatus.CANCELED:
      return download.filesDeletedAt ? [] : ['deleteFiles'];
  }
}

/**
 * Junta o registro do banco (estado confirmado) com o snapshot em tempo real (números
 * que mudam a cada segundo). Sem snapshot, velocidades ficam em 0 e a estimativa em null.
 */
export function toDownloadDto(download: DownloadRecord, snapshot?: DownloadSnapshot): DownloadDto {
  const live = snapshot && isActive(download.status) ? snapshot : undefined;
  return {
    id: download.id,
    status: download.status,
    progress: live?.progress ?? download.progress,
    downloadedBytes: live?.downloadedBytes ?? Number(download.downloadedBytes),
    totalBytes:
      live?.totalBytes ?? (download.totalBytes === null ? null : Number(download.totalBytes)),
    downloadSpeed: live?.downloadSpeed ?? 0,
    uploadSpeed: live?.uploadSpeed ?? 0,
    etaSeconds: live?.etaSeconds ?? null,
    peers: live?.peers ?? null,
    stalled: live?.stalled ?? false,
    seeding: live?.seeding ?? false,
    lastError: download.lastError,
    allowedActions: allowedActions(download),
    filesDeleted: download.filesDeletedAt !== null,
    folder: `${download.id}/`,
    game: download.source.game,
    source: {
      id: download.source.id,
      name: download.source.name,
      license: download.source.license,
    },
    createdAt: download.createdAt,
    updatedAt: download.updatedAt,
    completedAt: download.completedAt,
  };
}

/** Estados em que a tarefa existe no cliente e há números em tempo real. */
function isActive(status: DownloadStatus): boolean {
  return status !== DownloadStatus.CANCELED && status !== DownloadStatus.ERROR;
}

export function toProgressEvent(snapshot: DownloadSnapshot): DownloadProgressEventDto {
  const { userId: _userId, updatedAt: _updatedAt, seeds: _seeds, ...event } = snapshot;
  return event;
}

export function toSourceDto(source: PublicSource): DownloadSourceDto {
  return { ...source, sizeBytes: source.sizeBytes === null ? null : Number(source.sizeBytes) };
}

export function toClientStatusDto(status: ClientStatus | null, enabled: boolean): ClientStatusDto {
  if (!enabled) {
    return {
      enabled: false,
      available: false,
      message: 'Downloads desativados neste ambiente',
      checkedAt: null,
    };
  }
  return (
    status ?? {
      enabled: true,
      available: false,
      message: 'Verificando o cliente torrent…',
      checkedAt: null,
    }
  );
}
