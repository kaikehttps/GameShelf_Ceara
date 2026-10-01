import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useNavigate } from 'react-router';
import { getGame, listGames } from '../../api/endpoints';
import { useAuth } from '../../auth/useAuth';
import { Icon } from '../../components/Icon';
import { formatRating, genresLabel, plural, STATUS_LABELS, storesLabel } from '../../lib/format';
import { useLibraryActions, useLibraryStatuses } from '../../library/useLibrary';

/**
 * Destaque do topo do catálogo: o jogo mais bem avaliado (dado real, não editorial).
 * Some quando ninguém avaliou nada ainda.
 */
export function FeaturedBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { add } = useLibraryActions();

  const top = useQuery({
    queryKey: ['games', { sort: 'rating', pageSize: 1 }],
    queryFn: () => listGames({ sort: 'rating', pageSize: 1 }),
  });
  const game = top.data?.items[0];
  const detail = useQuery({
    queryKey: ['game', game?.id],
    queryFn: ({ signal }) => getGame(game!.id, signal),
    enabled: game !== undefined,
  });
  const status = useLibraryStatuses(game ? [game.id] : []).get(game?.id ?? '');

  if (top.isPending) {
    return (
      <div className="h-[240px] animate-pulse rounded-xl border border-app-border bg-app-card" />
    );
  }
  if (!game || game.rating.average === null) {
    return null;
  }

  const handleAdd = () => {
    if (!user) {
      void navigate(`/entrar?next=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    add.mutate({ gameId: game.id });
  };

  const image = game.bannerUrl ?? game.coverUrl;

  return (
    <section className="group relative flex h-[240px] w-full items-center overflow-hidden rounded-xl border border-app-border bg-app-card shadow-sm">
      {image && (
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
          style={{ backgroundImage: `url("${image}")` }}
        />
      )}
      {/* Gradientes para o texto ficar legível sobre qualquer imagem. */}
      <div className="absolute inset-0 w-3/4 bg-gradient-to-r from-app-bg via-app-bg/85 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-app-bg/60 via-transparent to-transparent" />

      <div className="relative z-10 flex h-full max-w-xl flex-col justify-center p-6 md:p-8">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 rounded border border-app-border bg-app-surface px-2 py-0.5 text-[10px] font-bold tracking-wider text-app-accent uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-app-accent" />
            Mais bem avaliado
          </span>
          <span className="text-xs text-app-muted">
            • {formatRating(game.rating.average)} ★ (
            {plural(game.rating.count, 'avaliação', 'avaliações')})
          </span>
          {game.genres.length > 0 && (
            <span className="hidden text-xs text-app-muted sm:inline">
              • {genresLabel(game.genres)}
            </span>
          )}
          {game.stores.length > 0 && (
            <span className="hidden text-xs text-app-muted sm:inline">
              • {storesLabel(game.stores)}
            </span>
          )}
        </div>
        <h2 className="mb-2 text-2xl leading-tight font-bold tracking-tight lg:text-3xl">
          {game.name}
        </h2>
        {detail.data?.description && (
          <p className="mb-5 line-clamp-2 text-xs leading-relaxed text-app-muted lg:text-sm">
            {detail.data.description}
          </p>
        )}
        <div className="flex items-center gap-3">
          <Link to={`/jogos/${game.id}`} className="btn-primary">
            <Icon name="info" className="text-[16px]" />
            Ver detalhes
          </Link>
          {status ? (
            <span className="inline-flex h-9 items-center gap-1.5 rounded-md border border-app-border bg-app-surface px-3.5 text-xs font-medium">
              <Icon name="check_circle" className="text-[16px] text-app-accent" />
              Na biblioteca · {STATUS_LABELS[status]}
            </span>
          ) : (
            <button
              type="button"
              onClick={handleAdd}
              disabled={add.isPending}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-app-border bg-app-surface px-3.5 text-xs font-medium transition-colors hover:bg-app-border disabled:opacity-50"
            >
              <Icon name="bookmark_add" className="text-[16px] text-app-accent" />
              Adicionar à biblioteca
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
