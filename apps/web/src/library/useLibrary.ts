import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import {
  addToLibrary,
  libraryStatusOf,
  removeFromLibrary,
  updateLibraryStatus,
} from '../api/endpoints';
import type { LibraryStatus } from '../api/types';
import { useAuth } from '../auth/useAuth';
import { STATUS_LABELS } from '../lib/format';
import { useToast } from '../toast/context';

/**
 * Status, na biblioteca do usuário, dos jogos exibidos (uma requisição por página).
 * Sem login, devolve um mapa vazio sem chamar a API.
 */
export function useLibraryStatuses(gameIds: string[]): Map<string, LibraryStatus> {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ['libraryStatus', user?.id, gameIds],
    queryFn: () => libraryStatusOf(gameIds),
    enabled: user !== null && gameIds.length > 0,
  });
  return new Map(data?.map((entry) => [entry.gameId, entry.status]));
}

/** Adicionar, mudar status e remover, com aviso de sucesso ou erro. */
export function useLibraryActions() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const refresh = useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['library'] }),
        queryClient.invalidateQueries({ queryKey: ['libraryStatus'] }),
      ]),
    [queryClient],
  );
  const onError = (error: Error) => showToast(error.message, 'error');

  const add = useMutation({
    mutationFn: ({ gameId, status }: { gameId: string; status?: LibraryStatus }) =>
      addToLibrary(gameId, status),
    onSuccess: (entry) => showToast(`${entry.game.name} entrou na sua biblioteca.`),
    onError,
    onSettled: refresh,
  });

  const update = useMutation({
    mutationFn: ({ gameId, status }: { gameId: string; status: LibraryStatus }) =>
      updateLibraryStatus(gameId, status),
    onSuccess: (entry) => showToast(`${entry.game.name}: ${STATUS_LABELS[entry.status]}.`),
    onError,
    onSettled: refresh,
  });

  const remove = useMutation({
    mutationFn: (gameId: string) => removeFromLibrary(gameId),
    onSuccess: () => showToast('Jogo removido da sua biblioteca.'),
    onError,
    onSettled: refresh,
  });

  return { add, update, remove };
}
