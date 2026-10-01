import { Link, useLocation, useNavigate } from 'react-router';
import type { GameSummary, LibraryStatus } from '../api/types';
import { useAuth } from '../auth/useAuth';
import { formatRating, genresLabel, STATUS_LABELS, storesLabel } from '../lib/format';
import { useLibraryActions } from '../library/useLibrary';
import { Icon } from './Icon';
import { LibraryMenu } from './LibraryMenu';

interface GameCardProps {
  game: GameSummary;
  /** Status na biblioteca do usuário; undefined = fora da biblioteca (ou sem login). */
  status: LibraryStatus | undefined;
}

export function GameCard({ game, status }: GameCardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { add, update, remove } = useLibraryActions();
  const busy = add.isPending || update.isPending || remove.isPending;

  const handleAdd = () => {
    if (!user) {
      // Sem login: entra e volta para a mesma página.
      void navigate(`/entrar?next=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    add.mutate({ gameId: game.id });
  };

  return (
    // "relative" + z-index enquanto o menu está aberto: o hover cria um novo contexto de
    // empilhamento (transform) e, sem isso, os cards da linha de baixo cobririam o menu.
    <article className="group relative flex flex-col justify-between rounded-lg border border-app-border bg-app-card p-2 transition-all duration-200 hover:-translate-y-0.5 hover:border-app-muted/40 has-[[aria-expanded=true]]:z-20">
      <Link to={`/jogos/${game.id}`} className="flex flex-col">
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-md border border-app-border/50 bg-app-surface">
          {game.coverUrl ? (
            <img
              src={game.coverUrl}
              alt={`Capa de ${game.name}`}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-app-muted">
              <Icon name="image_not_supported" className="text-[28px]" />
            </div>
          )}
          {game.stores.length > 0 && (
            <span className="absolute top-2 right-2 rounded border border-app-border bg-app-bg/80 px-1.5 py-0.5 text-[10px] font-semibold text-app-muted backdrop-blur">
              {storesLabel(game.stores)}
            </span>
          )}
        </div>
        <div className="mt-2.5 px-0.5">
          <h3 className="line-clamp-1 text-sm font-semibold transition-colors group-hover:text-app-accent">
            {game.name}
          </h3>
          <p className="mt-0.5 line-clamp-1 text-xs text-app-muted">
            {genresLabel(game.genres) || 'Sem gênero informado'}
          </p>
        </div>
      </Link>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-app-border/60 pt-2">
        {status ? (
          <span className="inline-flex min-w-0 items-center gap-1 text-[11px] font-medium text-app-accent">
            <Icon name="check_circle" className="text-[14px]" />
            <span className="truncate">{STATUS_LABELS[status]}</span>
          </span>
        ) : (
          <button
            type="button"
            onClick={handleAdd}
            disabled={busy}
            className="flex h-6 items-center gap-1 rounded border border-app-border bg-app-surface px-2 text-[11px] font-medium transition-colors hover:bg-app-border disabled:opacity-50"
          >
            <Icon name="add" className="text-[13px] text-app-accent" />
            Adicionar
          </button>
        )}

        <div className="flex shrink-0 items-center gap-1">
          <span
            className="flex items-center gap-0.5 text-[11px] text-app-muted"
            title={
              game.rating.average === null
                ? 'Ainda sem avaliações'
                : `Média ${formatRating(game.rating.average)} em ${game.rating.count} avaliação(ões)`
            }
          >
            <Icon
              name="star"
              filled={game.rating.average !== null}
              className={`text-[13px] ${game.rating.average === null ? 'text-app-border' : 'text-app-accent'}`}
            />
            {game.rating.average === null ? '—' : formatRating(game.rating.average)}
          </span>
          {status && (
            <LibraryMenu
              gameName={game.name}
              status={status}
              disabled={busy}
              onChange={(next) => update.mutate({ gameId: game.id, status: next })}
              onRemove={() => remove.mutate(game.id)}
            />
          )}
        </div>
      </div>
    </article>
  );
}
