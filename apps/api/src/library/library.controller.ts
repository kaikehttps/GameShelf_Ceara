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
import {
  AddToLibraryDto,
  LibraryEntryDto,
  LibraryGameStatusDto,
  LibraryPageDto,
  LibraryQueryDto,
  LibraryStatusQueryDto,
  UpdateLibraryEntryDto,
} from './dto/library.dto.js';
import { LibraryService } from './library.service.js';

/** Biblioteca do usuário autenticado. Não há rota para ver a biblioteca de outra pessoa. */
@ApiTags('library')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Access token ausente, inválido ou expirado.' })
@Controller('library')
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @Get()
  @ApiOperation({ summary: 'Lista a sua biblioteca, das alterações mais recentes às mais antigas' })
  @ApiOkResponse({ type: LibraryPageDto })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: LibraryQueryDto,
  ): Promise<LibraryPageDto> {
    return this.library.list(user.id, query);
  }

  @Get('status')
  @ApiOperation({
    summary: 'Status, na sua biblioteca, de uma lista de jogos',
    description:
      'Usado pelo catálogo para marcar "Na biblioteca" em uma página de jogos com uma só ' +
      'requisição. Jogos fora da biblioteca não aparecem na resposta.',
  })
  @ApiOkResponse({ type: [LibraryGameStatusDto] })
  @ApiBadRequestResponse({ description: 'Lista vazia, com mais de 50 ids ou id inválido.' })
  statusOf(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: LibraryStatusQueryDto,
  ): Promise<LibraryGameStatusDto[]> {
    return this.library.statusOf(user.id, query.gameIds);
  }

  @Post()
  @ApiOperation({ summary: 'Adiciona um jogo (status padrão: WANT_TO_PLAY)' })
  @ApiCreatedResponse({ type: LibraryEntryDto })
  @ApiBadRequestResponse({ description: 'gameId ou status inválido.' })
  @ApiNotFoundResponse({ description: 'Jogo não encontrado.' })
  @ApiConflictResponse({ description: 'O jogo já está na biblioteca.' })
  add(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddToLibraryDto,
  ): Promise<LibraryEntryDto> {
    return this.library.add(user.id, dto);
  }

  @Patch(':gameId')
  @ApiOperation({ summary: 'Altera o status de um jogo da sua biblioteca' })
  @ApiOkResponse({ type: LibraryEntryDto })
  @ApiNotFoundResponse({ description: 'O jogo não está na sua biblioteca.' })
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('gameId', ParseUUIDPipe) gameId: string,
    @Body() dto: UpdateLibraryEntryDto,
  ): Promise<LibraryEntryDto> {
    return this.library.updateStatus(user.id, gameId, dto.status);
  }

  @Delete(':gameId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove um jogo da sua biblioteca' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'O jogo não está na sua biblioteca.' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('gameId', ParseUUIDPipe) gameId: string,
  ): Promise<void> {
    await this.library.remove(user.id, gameId);
  }
}
