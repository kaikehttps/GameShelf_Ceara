import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { listLibrary } from '../api/endpoints';
import type { LibraryStatus } from '../api/types';
import { useAuth } from '../auth/useAuth';
import { GameCard } from '../components/GameCard';
import { Pagination } from '../components/Pagination';
import { EmptyState, ErrorState, GridSkeleton } from '../components/States';
import { PageHeader } from '../layout/PageHeader';
import { LIBRARY_STATUSES, plural, STATUS_LABELS } from '../lib/format';

const PAGE_SIZE = 20;

const isStatus = (value: string | null): value is LibraryStatus =>
  LIBRARY_STATUSES.includes(value as LibraryStatus);

export function LibraryPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const statusParam = params.get('status');
  const status = isStatus(statusParam) ? statusParam : undefined;
  const page = Math.max(1, Math.floor(Number(params.get('pagina'))) || 1);

  const library = useQuery({
    queryKey: ['library', user?.id, status, page],
    queryFn: () => listLibrary({ status, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  const total = useQuery({
    queryKey: ['library', user?.id, 'total'],
    queryFn: () => listLibrary({ pageSize: 1 }),
  });

  const select = (next: LibraryStatus | undefined) => setParams(next ? { status: next } : {});

  return (
    <>
      <PageHeader
        title="Minha biblioteca"
        subtitle={total.data && plural(total.data.total, 'jogo', 'jogos')}
      />
      <main className="flex-1 space-y-5 overflow-y-auto px-4 py-6 md:px-8">
        <div
          className="flex flex-wrap items-center gap-2 rounded-lg border border-app-border bg-app-card p-2.5"
          role="group"
          aria-label="Filtrar por status"
        >
          <span className="mr-1 text-[11px] font-semibold tracking-wider text-app-muted uppercase">
            Status:
          </span>
          <button
            type="button"
            aria-pressed={!status}
            className={!status ? 'chip-active' : 'chip'}
            onClick={() => select(undefined)}
          >
            Todos
          </button>
          {LIBRARY_STATUSES.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={status === option}
              className={status === option ? 'chip-active' : 'chip'}
              onClick={() => select(option)}
            >
              {STATUS_LABELS[option]}
            </button>
          ))}
        </div>

        {library.isPending ? (
          <GridSkeleton count={5} />
        ) : library.isError ? (
          <ErrorState error={library.error} onRetry={() => void library.refetch()} />
        ) : library.data.items.length === 0 ? (
          status ? (
            <EmptyState icon="filter_alt_off" title={`Nenhum jogo em "${STATUS_LABELS[status]}"`}>
              Mude o status de um jogo pelo menu ⋮ do card ou na página do jogo.
            </EmptyState>
          ) : (
            <EmptyState
              icon="sports_esports"
              title="Sua biblioteca está vazia"
              action={
                <Link to="/" className="btn-primary">
                  Explorar o catálogo
                </Link>
              }
            >
              Adicione jogos pelo catálogo para acompanhar o que quer jogar, está jogando ou já
              terminou.
            </EmptyState>
          )
        ) : (
          <>
            <div
              className={`grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 ${
                library.isPlaceholderData ? 'opacity-60' : ''
              }`}
            >
              {library.data.items.map((entry) => (
                <GameCard key={entry.game.id} game={entry.game} status={entry.status} />
              ))}
            </div>
            <Pagination
              page={library.data.page}
              totalPages={library.data.totalPages}
              onChange={(next) =>
                setParams({
                  ...(status ? { status } : {}),
                  ...(next > 1 ? { pagina: String(next) } : {}),
                })
              }
            />
          </>
        )}
      </main>
    </>
  );
}
