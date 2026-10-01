import { useLocation, useNavigate } from 'react-router';
import type { GameDetail, LibraryStatus } from '../../api/types';
import { useAuth } from '../../auth/useAuth';
import { Icon } from '../../components/Icon';
import { Stars } from '../../components/Stars';
import {
  formatRating,
  genresLabel,
  LIBRARY_STATUSES,
  plural,
  releaseYear,
  STATUS_LABELS,
} from '../../lib/format';
import { useLibraryActions, useLibraryStatuses } from '../../library/useLibrary';

export function GameHero({ game }: { game: GameDetail }) {
  const status = useLibraryStatuses([game.id]).get(game.id);
  const storeLinks = game.externalIds.filter((external) => external.storeUrl !== null);
  const year = releaseYear(game.releaseDate);
  const image = game.bannerUrl ?? game.coverUrl;

  return (
    <section className="relative overflow-hidden rounded-xl border border-app-border bg-app-card">
      {image && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-60"
          style={{ backgroundImage: `url("${image}")` }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-app-bg via-app-bg/90 to-app-bg/40" />
      <div className="absolute inset-0 bg-gradient-to-t from-app-bg/80 via-transparent to-transparent" />

      <div className="relative z-10 flex flex-col gap-6 p-6 sm:flex-row sm:items-end md:p-8">
        <div className="aspect-[3/4] w-36 shrink-0 overflow-hidden rounded-lg border border-app-border bg-app-surface shadow-lg md:w-44">
          {game.coverUrl ? (
            <img
              src={game.coverUrl}
              alt={`Capa de ${game.name}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-app-muted">
              <Icon name="image_not_supported" className="text-[28px]" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="mb-2 text-xs text-app-muted">
            {[year, genresLabel(game.genres, 3)].filter(Boolean).join(' • ')}
          </p>
          <h1 className="mb-3 text-2xl leading-tight font-bold tracking-tight md:text-3xl">
            {game.name}
          </h1>
          <div className="mb-5 flex items-center gap-2 text-sm">
            {game.rating.average === null ? (
              <span className="text-app-muted">Ainda sem avaliações</span>
            ) : (
              <>
                <Stars value={game.rating.average} />
                <span className="font-semibold">{formatRating(game.rating.average)}</span>
                <span className="text-app-muted">
                  · {plural(game.rating.count, 'avaliação', 'avaliações')}
                </span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <LibraryControl gameId={game.id} gameName={game.name} status={status} />
            {storeLinks.map((external) => (
              <a
                key={external.provider}
                href={external.storeUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-app-border bg-app-surface px-3.5 text-xs font-medium transition-colors hover:bg-app-border"
              >
                <Icon name="open_in_new" className="text-[16px] text-app-muted" />
                Ver na {external.provider === 'STEAM' ? 'Steam' : external.provider}
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

interface LibraryControlProps {
  gameId: string;
  gameName: string;
  status: LibraryStatus | undefined;
}

/** Fora da biblioteca: botão "Adicionar". Dentro: escolha do status e "Remover". */
function LibraryControl({ gameId, gameName, status }: LibraryControlProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { add, update, remove } = useLibraryActions();
  const busy = add.isPending || update.isPending || remove.isPending;

  if (!status) {
    return (
      <button
        type="button"
        className="btn-primary"
        disabled={busy}
        onClick={() =>
          user
            ? add.mutate({ gameId })
            : void navigate(`/entrar?next=${encodeURIComponent(location.pathname)}`)
        }
      >
        <Icon name="bookmark_add" className="text-[16px]" />
        Adicionar à biblioteca
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <label className="relative">
        <span className="sr-only">Status de {gameName} na biblioteca</span>
        <select
          value={status}
          disabled={busy}
          onChange={(event) =>
            update.mutate({ gameId, status: event.target.value as LibraryStatus })
          }
          className="h-9 cursor-pointer appearance-none rounded-md border border-app-accent/60 bg-app-surface pr-8 pl-3 text-xs font-medium text-app-accent focus:outline-none disabled:opacity-50"
        >
          {LIBRARY_STATUSES.map((option) => (
            <option key={option} value={option}>
              {STATUS_LABELS[option]}
            </option>
          ))}
        </select>
        <Icon
          name="expand_more"
          className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[16px] text-app-accent"
        />
      </label>
      <button
        type="button"
        className="btn-danger h-9"
        disabled={busy}
        onClick={() => remove.mutate(gameId)}
      >
        <Icon name="delete" className="text-[16px]" />
        Remover
      </button>
    </div>
  );
}
