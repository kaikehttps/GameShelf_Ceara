import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { listGames, listGenres, listPlatforms } from '../api/endpoints';
import type { GameSort, Taxonomy } from '../api/types';
import { GameCard } from '../components/GameCard';
import { Icon } from '../components/Icon';
import { Pagination } from '../components/Pagination';
import { EmptyState, ErrorState, GridSkeleton } from '../components/States';
import { PageHeader } from '../layout/PageHeader';
import { plural } from '../lib/format';
import { useLibraryStatuses } from '../library/useLibrary';
import { FeaturedBanner } from './catalog/FeaturedBanner';

const PAGE_SIZE = 20;
const SEARCH_MAX_LENGTH = 100;
const SEARCH_DEBOUNCE_MS = 300;

/** Só critérios que a API sabe ordenar (não há preço nem popularidade no catálogo). */
const SORT_OPTIONS: { value: GameSort; label: string }[] = [
  { value: 'rating', label: 'Mais bem avaliados' },
  { value: 'releaseDate', label: 'Lançamentos recentes' },
  { value: 'name', label: 'Nome (A–Z)' },
  { value: 'createdAt', label: 'Adicionados recentemente' },
];
const DEFAULT_SORT: GameSort = 'rating';

const isGameSort = (value: string | null): value is GameSort =>
  SORT_OPTIONS.some((option) => option.value === value);

/** Os filtros vivem na URL (?busca=&genero=&plataforma=&ordem=&pagina=). */
type CatalogParam = 'busca' | 'genero' | 'plataforma' | 'ordem' | 'pagina';

export function CatalogPage() {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const q = params.get('busca') ?? '';
  const genre = params.get('genero') ?? '';
  const platform = params.get('plataforma') ?? '';
  const sortParam = params.get('ordem');
  const sort = isGameSort(sortParam) ? sortParam : DEFAULT_SORT;
  const page = Math.max(1, Math.floor(Number(params.get('pagina'))) || 1);

  const updateParams = (changes: Partial<Record<CatalogParam, string | null>>, replace = false) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (value) {
            next.set(key, value);
          } else {
            next.delete(key);
          }
        }
        return next;
      },
      { replace },
    );
  };

  // Campo de busca: o texto muda na hora; a URL (e a consulta) só depois de uma pausa.
  const [searchText, setSearchText] = useState(q);
  const [syncedQ, setSyncedQ] = useState(q);
  if (q !== syncedQ) {
    // A URL mudou por fora (link do menu, botão voltar): o campo acompanha.
    setSyncedQ(q);
    setSearchText(q);
  }
  useEffect(() => {
    const trimmed = searchText.trim();
    if (trimmed === q) {
      return;
    }
    const timer = setTimeout(
      () => updateParams({ busca: trimmed || null, pagina: null }, true),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
    // updateParams muda a cada render; o que importa aqui é o texto e a URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText, q]);

  // Ctrl+K (ou Cmd+K) foca a busca, como indica o atalho no campo.
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const listParams = {
    q: q || undefined,
    genre: genre || undefined,
    platform: platform || undefined,
    sort,
    page,
    pageSize: PAGE_SIZE,
  };
  const games = useQuery({
    queryKey: ['games', listParams],
    queryFn: ({ signal }) => listGames(listParams, signal),
    // Mantém a página anterior na tela enquanto a próxima carrega (sem "piscar").
    placeholderData: keepPreviousData,
  });
  const catalogTotal = useQuery({
    queryKey: ['games', { pageSize: 1 }],
    queryFn: () => listGames({ pageSize: 1 }),
  });
  const genres = useQuery({ queryKey: ['genres'], queryFn: listGenres, staleTime: 5 * 60_000 });
  const platforms = useQuery({
    queryKey: ['platforms'],
    queryFn: listPlatforms,
    staleTime: 5 * 60_000,
  });
  const statuses = useLibraryStatuses(games.data?.items.map((game) => game.id) ?? []);

  const hasFilters = Boolean(q || genre || platform);
  const refresh = () => queryClient.invalidateQueries();

  return (
    <>
      <PageHeader
        title="Catálogo"
        subtitle={
          catalogTotal.data &&
          plural(catalogTotal.data.total, 'jogo disponível', 'jogos disponíveis')
        }
      >
        <div className="relative w-44 sm:w-64 lg:w-80">
          <Icon
            name="search"
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[18px] text-app-muted"
          />
          <input
            ref={searchRef}
            type="search"
            value={searchText}
            maxLength={SEARCH_MAX_LENGTH}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Buscar jogos pelo nome…"
            aria-label="Buscar jogos pelo nome"
            className="input pr-14 pl-9"
          />
          <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 items-center gap-0.5 rounded border border-app-border bg-app-surface px-1.5 py-0.5 font-sans text-[10px] font-medium text-app-muted sm:flex">
            Ctrl + K
          </kbd>
        </div>
        <button
          type="button"
          onClick={refresh}
          title="Atualizar"
          aria-label="Atualizar"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-app-muted transition-colors hover:border-app-border hover:bg-app-surface hover:text-app-text"
        >
          <Icon name="refresh" className="text-[19px]" />
        </button>
      </PageHeader>

      <main className="flex-1 space-y-7 overflow-y-auto px-4 py-6 md:px-8">
        {!hasFilters && page === 1 && <FeaturedBanner />}

        <section className="space-y-4" aria-labelledby="explore-title">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 id="explore-title" className="text-lg font-bold">
                Explore o catálogo
              </h2>
              <p className="text-xs text-app-muted">
                Jogos de PC identificados nas lojas, com avaliações da comunidade
              </p>
            </div>
            <label className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-xs text-app-muted">Ordenar por:</span>
              <span className="relative">
                <select
                  value={sort}
                  onChange={(event) => updateParams({ ordem: event.target.value, pagina: null })}
                  className="h-8 cursor-pointer appearance-none rounded-md border border-app-border bg-app-card pr-8 pl-3 text-xs transition-colors hover:bg-app-surface focus:border-app-accent focus:outline-none"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <Icon
                  name="expand_more"
                  className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[16px] text-app-muted"
                />
              </span>
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-app-border bg-app-card p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <FilterChips
                label="Plataforma"
                allLabel="Todas"
                options={platforms.data}
                selected={platform}
                onSelect={(slug) => updateParams({ plataforma: slug, pagina: null })}
              />
              <span className="mx-2 hidden h-4 w-px bg-app-border md:block" />
              <FilterChips
                label="Gênero"
                allLabel="Todos"
                options={genres.data}
                selected={genre}
                onSelect={(slug) => updateParams({ genero: slug, pagina: null })}
              />
            </div>
            {games.data && (
              <div className="text-xs text-app-muted">
                Exibindo{' '}
                <span className="font-medium text-app-text">{games.data.items.length}</span> de{' '}
                {games.data.total.toLocaleString('pt-BR')}
              </div>
            )}
          </div>

          {games.isPending ? (
            <GridSkeleton />
          ) : games.isError ? (
            <ErrorState error={games.error} onRetry={() => void games.refetch()} />
          ) : games.data.items.length === 0 ? (
            <EmptyState
              icon="search_off"
              title={hasFilters ? 'Nenhum jogo encontrado' : 'O catálogo está vazio'}
              action={
                hasFilters ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() =>
                      updateParams({ busca: null, genero: null, plataforma: null, pagina: null })
                    }
                  >
                    Limpar busca e filtros
                  </button>
                ) : page > 1 ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => updateParams({ pagina: null })}
                  >
                    Voltar à primeira página
                  </button>
                ) : undefined
              }
            >
              {hasFilters
                ? 'Tente outras palavras ou remova algum filtro.'
                : 'Rode o seed (npm run db:seed) para carregar os jogos de demonstração.'}
            </EmptyState>
          ) : (
            <>
              <div
                className={`grid grid-cols-2 gap-4 pt-1 transition-opacity sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 ${
                  games.isPlaceholderData ? 'opacity-60' : ''
                }`}
              >
                {games.data.items.map((game) => (
                  <GameCard key={game.id} game={game} status={statuses.get(game.id)} />
                ))}
              </div>
              <Pagination
                page={games.data.page}
                totalPages={games.data.totalPages}
                onChange={(next) => updateParams({ pagina: next > 1 ? String(next) : null })}
              />
            </>
          )}
        </section>
      </main>
    </>
  );
}

interface FilterChipsProps {
  label: string;
  allLabel: string;
  options: Taxonomy[] | undefined;
  selected: string;
  onSelect: (slug: string | null) => void;
}

function FilterChips({ label, allLabel, options, selected, onSelect }: FilterChipsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={label}>
      <span className="mr-1 text-[11px] font-semibold tracking-wider text-app-muted uppercase">
        {label}:
      </span>
      <button
        type="button"
        aria-pressed={!selected}
        className={!selected ? 'chip-active' : 'chip'}
        onClick={() => onSelect(null)}
      >
        {allLabel}
      </button>
      {options?.map((option) => (
        <button
          key={option.slug}
          type="button"
          aria-pressed={selected === option.slug}
          className={selected === option.slug ? 'chip-active' : 'chip'}
          onClick={() => onSelect(option.slug)}
        >
          {option.name}
        </button>
      ))}
    </div>
  );
}
