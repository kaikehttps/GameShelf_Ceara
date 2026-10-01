import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CatalogService } from '../catalog/catalog.service.js';
import { pageArgs, toPage, type Page } from '../common/pagination.js';
import type { LibraryStatus } from '../generated/prisma/client.js';
import { isRecordNotFoundError, isUniqueConstraintError } from '../prisma/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  toLibraryEntry,
  type AddToLibraryDto,
  type LibraryEntryDto,
  type LibraryGameStatusDto,
  type LibraryQueryDto,
} from './dto/library.dto.js';
import { libraryEntrySelect } from './library-entry-select.js';

const NOT_IN_LIBRARY = 'Este jogo não está na sua biblioteca';

/**
 * Toda consulta filtra pelo `userId` que veio do access token, e as rotas identificam
 * o registro pelo jogo (não por um id de registro). Assim não existe forma de pedir,
 * alterar ou apagar a entrada de outro usuário: ela simplesmente não é encontrada.
 */
@Injectable()
export class LibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
  ) {}

  async list(userId: string, query: LibraryQueryDto): Promise<Page<LibraryEntryDto>> {
    const where = { userId, status: query.status };
    const [total, entries] = await Promise.all([
      this.prisma.libraryEntry.count({ where }),
      this.prisma.libraryEntry.findMany({
        where,
        // Mais recentes primeiro; o id (UUIDv7, crescente no tempo) desempata.
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        ...pageArgs(query),
        select: libraryEntrySelect,
      }),
    ]);
    return toPage(entries.map(toLibraryEntry), total, query);
  }

  /** Quais destes jogos estão na biblioteca do usuário (os demais simplesmente não aparecem). */
  statusOf(userId: string, gameIds: string[]): Promise<LibraryGameStatusDto[]> {
    return this.prisma.libraryEntry.findMany({
      where: { userId, gameId: { in: gameIds } },
      select: { gameId: true, status: true },
    });
  }

  async add(userId: string, dto: AddToLibraryDto): Promise<LibraryEntryDto> {
    await this.catalog.assertGameExists(dto.gameId);
    try {
      const entry = await this.prisma.libraryEntry.create({
        data: { userId, gameId: dto.gameId, status: dto.status },
        select: libraryEntrySelect,
      });
      return toLibraryEntry(entry);
    } catch (error) {
      // UNIQUE (user_id, game_id): vale também para duas requisições simultâneas.
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('Este jogo já está na sua biblioteca');
      }
      throw error;
    }
  }

  async updateStatus(
    userId: string,
    gameId: string,
    status: LibraryStatus,
  ): Promise<LibraryEntryDto> {
    try {
      const entry = await this.prisma.libraryEntry.update({
        where: { userId_gameId: { userId, gameId } },
        data: { status },
        select: libraryEntrySelect,
      });
      return toLibraryEntry(entry);
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        throw new NotFoundException(NOT_IN_LIBRARY);
      }
      throw error;
    }
  }

  async remove(userId: string, gameId: string): Promise<void> {
    const { count } = await this.prisma.libraryEntry.deleteMany({ where: { userId, gameId } });
    if (count === 0) {
      throw new NotFoundException(NOT_IN_LIBRARY);
    }
  }
}
