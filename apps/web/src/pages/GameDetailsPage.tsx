import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { ApiError } from '../api/client';
import { getGame } from '../api/endpoints';
import type { GameDetail } from '../api/types';
import { Icon } from '../components/Icon';
import { EmptyState, ErrorState, Spinner } from '../components/States';
import { PageHeader } from '../layout/PageHeader';
import { formatReleaseDate } from '../lib/format';
import { GameHero } from './game/GameHero';
import { ReviewsSection } from './game/ReviewsSection';

export function GameDetailsPage() {
  const { id = '' } = useParams();
  const game = useQuery({
    queryKey: ['game', id],
    queryFn: ({ signal }) => getGame(id, signal),
  });

  const back = (
    <Link
      to="/"
      className="inline-flex items-center gap-1 text-app-muted transition-colors hover:text-app-text"
    >
      <Icon name="arrow_back" className="text-[20px]" />
      <span className="text-base font-semibold">Catálogo</span>
    </Link>
  );

  // 400 (id que não é UUID) e 404 significam a mesma coisa para quem navega.
  const notFound = game.error instanceof ApiError && [400, 404].includes(game.error.status);

  return (
    <>
      <PageHeader title={back} />
      <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
        {game.isPending ? (
          <Spinner label="Carregando o jogo…" />
        ) : notFound ? (
          <EmptyState
            icon="sports_esports"
            title="Jogo não encontrado"
            action={
              <Link to="/" className="btn-secondary">
                Voltar ao catálogo
              </Link>
            }
          >
            O link pode estar errado, ou o jogo saiu do catálogo.
          </EmptyState>
        ) : game.isError ? (
          <ErrorState error={game.error} onRetry={() => void game.refetch()} />
        ) : (
          <div className="mx-auto max-w-6xl space-y-8">
            <GameHero game={game.data} />
            <div className="grid gap-8 lg:grid-cols-3">
              <div className="space-y-8 lg:col-span-2">
                <section aria-labelledby="about-title">
                  <h2 id="about-title" className="mb-3 text-lg font-bold">
                    Sobre o jogo
                  </h2>
                  <p className="text-sm leading-relaxed text-app-text/90">
                    {game.data.description ?? 'Sem descrição disponível.'}
                  </p>
                </section>
                <ReviewsSection gameId={game.data.id} />
              </div>
              <GameFacts game={game.data} />
            </div>
          </div>
        )}
      </main>
    </>
  );
}

function GameFacts({ game }: { game: GameDetail }) {
  return (
    <aside className="h-fit rounded-lg border border-app-border bg-app-card p-5">
      <h2 className="mb-4 text-sm font-semibold">Ficha técnica</h2>
      <dl className="space-y-4 text-sm">
        <Fact label="Lançamento">
          {game.releaseDate ? formatReleaseDate(game.releaseDate) : 'Não informado'}
        </Fact>
        <Fact label="Gêneros">{game.genres.map((genre) => genre.name).join(', ') || '—'}</Fact>
        <Fact label="Plataformas">
          {game.platforms.map((platform) => platform.name).join(', ') || '—'}
        </Fact>
        <Fact label="Identificadores nas lojas">
          {game.externalIds.length === 0
            ? '—'
            : game.externalIds.map((external) => (
                <span key={external.provider} className="block">
                  {external.provider} · {external.externalId}
                </span>
              ))}
        </Fact>
      </dl>
    </aside>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold tracking-wider text-app-muted uppercase">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}
