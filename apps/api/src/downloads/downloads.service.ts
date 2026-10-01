import {
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  type MessageEvent,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { pageArgs, toPage, type Page } from '../common/pagination.js';
import type { Env } from '../config/env.js';
import { DownloadSourceKind, DownloadStatus } from '../generated/prisma/client.js';
import { isUniqueConstraintError } from '../prisma/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { downloadSelect, publicSourceSelect, type DownloadRecord } from './download-select.js';
import {
  toClientStatusDto,
  toDownloadDto,
  toProgressEvent,
  toSourceDto,
  type ClientStatusDto,
  type DownloadDto,
  type DownloadSourceDto,
  type ListDownloadsQueryDto,
} from './dto/download.dto.js';
import { LiveState, type DownloadSnapshot } from './live/live-state.js';
import {
  downloadTag,
  MANAGED_TAG,
  QbittorrentClient,
  TorrentClientError,
} from './qbittorrent/qbittorrent.client.js';
import { clientSavePath, deleteTaskDirectory, TaskDirectoryError } from './task-directory.js';

/** Mesma mensagem para "já é seu" e "é de outra pessoa": não revela quem é o dono. */
const DUPLICATE_MESSAGE = 'Este torrent já está em uso por outro download ativo';
const NOT_FOUND_MESSAGE = 'Download não encontrado';

const PAUSABLE = new Set<DownloadStatus>([
  DownloadStatus.QUEUED,
  DownloadStatus.METADATA,
  DownloadStatus.DOWNLOADING,
  DownloadStatus.CHECKING,
]);

/** O que a fonte precisa ter para ser enviada ao cliente torrent. */
export interface SourceForClient {
  kind: DownloadSourceKind;
  reference: string;
  torrentFile: Uint8Array | null;
}

@Injectable()
export class DownloadsService {
  private readonly logger = new Logger(DownloadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: QbittorrentClient,
    private readonly live: LiveState,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Fontes ativas de um jogo (sem o link/arquivo, que só a API usa). */
  async listSources(gameId: string): Promise<DownloadSourceDto[]> {
    const sources = await this.prisma.downloadSource.findMany({
      where: { gameId, active: true },
      orderBy: { createdAt: 'asc' },
      select: publicSourceSelect,
    });
    return sources.map(toSourceDto);
  }

  async clientStatus(): Promise<ClientStatusDto> {
    const status = await this.live.getClientStatus().catch(() => null);
    return toClientStatusDto(status, this.client.enabled);
  }

  /** Primeiros eventos de uma conexão SSE: status do cliente e progresso dos downloads ativos. */
  async initialEvents(userId: string): Promise<MessageEvent[]> {
    const active = await this.prisma.download.findMany({
      where: { userId, activeInfoHash: { not: null } },
      select: { id: true },
    });
    const snapshots = await this.live
      .getSnapshots(active.map(({ id }) => id))
      .catch(() => new Map<string, DownloadSnapshot>());
    return [
      { type: 'client', data: await this.clientStatus() },
      ...[...snapshots.values()].map((snapshot) => ({
        type: 'download',
        data: toProgressEvent(snapshot),
      })),
    ];
  }

  async list(userId: string, query: ListDownloadsQueryDto): Promise<Page<DownloadDto>> {
    const where = { userId, status: query.status };
    const [total, downloads] = await Promise.all([
      this.prisma.download.count({ where }),
      this.prisma.download.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...pageArgs(query),
        select: downloadSelect,
      }),
    ]);
    return toPage(await this.withLiveData(downloads), total, query);
  }

  async get(userId: string, downloadId: string): Promise<DownloadDto> {
    const [dto] = await this.withLiveData([await this.findOwned(userId, downloadId)]);
    return dto;
  }

  /**
   * Inicia o download de uma fonte cadastrada.
   * 1. Grava o download e ocupa o "slot" do torrent (UNIQUE em active_info_hash): dois
   *    pedidos simultâneos para o mesmo torrent não passam os dois.
   * 2. Envia ao qBittorrent. Se falhar, desfaz o registro (compensação). Se o cliente
   *    chegou a criar a tarefa apesar do erro (timeout na resposta), a reconciliação do
   *    monitor remove o órfão, porque ele tem a tag gs-<id> e nenhum download ativo.
   */
  async start(userId: string, sourceId: string): Promise<DownloadDto> {
    this.assertEnabled();
    const source = await this.prisma.downloadSource.findFirst({
      where: { id: sourceId, active: true },
      select: { infoHash: true, sizeBytes: true, kind: true, reference: true, torrentFile: true },
    });
    if (!source) {
      throw new NotFoundException('Fonte de download não encontrada ou desativada');
    }

    let downloadId: string;
    try {
      ({ id: downloadId } = await this.prisma.download.create({
        data: {
          userId,
          sourceId,
          infoHash: source.infoHash,
          activeInfoHash: source.infoHash,
          totalBytes: source.sizeBytes,
        },
        select: { id: true },
      }));
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException(DUPLICATE_MESSAGE);
      }
      throw error;
    }

    try {
      await this.addToClient(downloadId, source.infoHash, source);
    } catch (error) {
      await this.prisma.download.delete({ where: { id: downloadId } });
      throw this.toHttpError(error);
    }
    return this.get(userId, downloadId);
  }

  async pause(userId: string, downloadId: string): Promise<DownloadDto> {
    const download = await this.findOwned(userId, downloadId);
    if (download.status === DownloadStatus.PAUSED) {
      return this.get(userId, downloadId); // repetir "pausar" não é erro
    }
    if (!PAUSABLE.has(download.status)) {
      throw new ConflictException('Este download não pode ser pausado no estado atual');
    }
    this.assertEnabled();
    await this.runClient(() => this.client.stop(download.infoHash));
    await this.prisma.download.update({
      where: { id: downloadId },
      data: { status: DownloadStatus.PAUSED },
    });
    return this.get(userId, downloadId);
  }

  async resume(userId: string, downloadId: string): Promise<DownloadDto> {
    const download = await this.findOwned(userId, downloadId);
    if (PAUSABLE.has(download.status)) {
      return this.get(userId, downloadId); // já está em andamento
    }
    if (download.status !== DownloadStatus.PAUSED) {
      throw new ConflictException('Só é possível retomar um download pausado');
    }
    this.assertEnabled();
    await this.runClient(() => this.client.start(download.infoHash));
    // "Na fila" até o monitor ler o estado real (baixando, buscando metadados...).
    await this.prisma.download.update({
      where: { id: downloadId },
      data: { status: DownloadStatus.QUEUED },
    });
    return this.get(userId, downloadId);
  }

  /**
   * Cancela: remove a tarefa do cliente e PRESERVA os arquivos. Primeiro o cliente, depois
   * o banco: se o cliente estiver fora do ar, nada muda e a resposta é 503 (dá para tentar
   * de novo). Cancelar de novo devolve o mesmo resultado.
   */
  async cancel(userId: string, downloadId: string): Promise<DownloadDto> {
    const download = await this.findOwned(userId, downloadId);
    if (download.status === DownloadStatus.CANCELED) {
      return this.get(userId, downloadId);
    }
    if (download.activeInfoHash) {
      this.assertEnabled();
      await this.runClient(() => this.client.remove(download.infoHash, false));
    }
    await this.prisma.download.update({
      where: { id: downloadId },
      data: {
        status: DownloadStatus.CANCELED,
        canceledAt: new Date(),
        activeInfoHash: null,
        lastError: null,
      },
    });
    return this.get(userId, downloadId);
  }

  /**
   * Exclui os arquivos de um download CANCELADO (a tarefa já saiu do cliente). Ação
   * separada e confirmada; apaga só a pasta `<raiz>/<id do download>`.
   */
  async deleteFiles(userId: string, downloadId: string): Promise<void> {
    const download = await this.findOwned(userId, downloadId);
    if (download.status !== DownloadStatus.CANCELED) {
      throw new ConflictException('Cancele o download antes de excluir os arquivos');
    }
    if (download.filesDeletedAt) {
      return;
    }
    const root = this.config.get('DOWNLOADS_DIR', { infer: true });
    if (!root) {
      throw new ServiceUnavailableException(
        'Exclusão de arquivos indisponível: DOWNLOADS_DIR não está configurada na API',
      );
    }
    try {
      const result = await deleteTaskDirectory(root, downloadId);
      this.logger.log(
        `Arquivos do download ${downloadId}: ${result === 'deleted' ? 'excluídos' : 'pasta já não existia'}`,
      );
    } catch (error) {
      if (error instanceof TaskDirectoryError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
    await this.prisma.download.update({
      where: { id: downloadId },
      data: { filesDeletedAt: new Date() },
    });
  }

  /**
   * Envia a fonte ao qBittorrent. Também usado pela reconciliação do monitor, por isso
   * trata "já existe" (409 do cliente): se o torrent existente é deste download (uma
   * tentativa anterior chegou lá), está tudo certo; se não, é conflito.
   */
  async addToClient(downloadId: string, infoHash: string, source: SourceForClient): Promise<void> {
    const result = await this.client.add({
      ...(source.kind === DownloadSourceKind.MAGNET
        ? { magnet: source.reference }
        : {
            torrentFile: {
              filename: source.reference,
              data: Buffer.from(source.torrentFile ?? []),
            },
          }),
      savePath: clientSavePath(this.config.get('QBT_SAVE_ROOT', { infer: true }), downloadId),
      tags: [MANAGED_TAG, downloadTag(downloadId)],
      upLimitBytes: this.config.get('DOWNLOADS_UPLOAD_LIMIT_KIB', { infer: true }) * 1024,
      ratioLimit: this.config.get('DOWNLOADS_SEED_RATIO_LIMIT', { infer: true }),
      seedingTimeLimitMinutes: this.config.get('DOWNLOADS_SEED_TIME_LIMIT_MINUTES', {
        infer: true,
      }),
    });
    if (result === 'exists') {
      const existing = await this.client.get(infoHash);
      const tags = existing?.tags.split(',').map((tag) => tag.trim()) ?? [];
      if (!tags.includes(downloadTag(downloadId))) {
        throw new TorrentClientError(DUPLICATE_MESSAGE, 'rejected');
      }
    }
  }

  private async findOwned(userId: string, downloadId: string): Promise<DownloadRecord> {
    // O filtro por userId é o isolamento: download de outra pessoa = não encontrado.
    const download = await this.prisma.download.findFirst({
      where: { id: downloadId, userId },
      select: downloadSelect,
    });
    if (!download) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
    return download;
  }

  private async withLiveData(downloads: DownloadRecord[]): Promise<DownloadDto[]> {
    // Sem os dados em tempo real (Redis fora do ar, por exemplo), a lista continua saindo.
    const snapshots = await this.live
      .getSnapshots(downloads.map((download) => download.id))
      .catch(() => new Map<string, DownloadSnapshot>());
    return downloads.map((download) => toDownloadDto(download, snapshots.get(download.id)));
  }

  private assertEnabled(): void {
    if (!this.client.enabled) {
      throw new ServiceUnavailableException(
        'Downloads desativados neste ambiente (QBT_URL não configurada)',
      );
    }
  }

  private async runClient(operation: () => Promise<void>): Promise<void> {
    try {
      await operation();
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  private toHttpError(error: unknown): HttpException {
    if (!(error instanceof TorrentClientError)) {
      throw error;
    }
    switch (error.kind) {
      case 'rejected':
        return new ConflictException(error.message);
      case 'disabled':
        return new ServiceUnavailableException('Downloads desativados neste ambiente');
      case 'auth':
        this.logger.error(`qBittorrent recusou as credenciais da API: ${error.message}`);
        return new ServiceUnavailableException('O cliente torrent está indisponível no momento');
      case 'unavailable':
        return new ServiceUnavailableException(
          'O cliente torrent está indisponível no momento. Tente de novo em instantes.',
        );
    }
  }
}
