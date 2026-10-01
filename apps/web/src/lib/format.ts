import type { CatalogProvider, LibraryStatus, Taxonomy } from '../api/types';

export const STATUS_LABELS: Record<LibraryStatus, string> = {
  WANT_TO_PLAY: 'Quero jogar',
  PLAYING: 'Jogando',
  COMPLETED: 'Finalizado',
  ABANDONED: 'Abandonado',
};

export const LIBRARY_STATUSES = Object.keys(STATUS_LABELS) as LibraryStatus[];

const STORE_LABELS: Record<CatalogProvider, string> = {
  STEAM: 'Steam',
  EPIC: 'Epic Games',
  LAUNCHBOX: 'LaunchBox',
};

export function storesLabel(stores: CatalogProvider[]): string {
  return stores.map((store) => STORE_LABELS[store]).join(' / ');
}

export function genresLabel(genres: Taxonomy[], max = 2): string {
  return genres
    .slice(0, max)
    .map((genre) => genre.name)
    .join(' / ');
}

const ratingFormat = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** 4.33 → "4,3". */
export function formatRating(average: number): string {
  return ratingFormat.format(average);
}

export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count.toLocaleString('pt-BR')} ${count === 1 ? singular : pluralForm}`;
}

/**
 * "2017-02-24" → "24/02/2017". A data do lançamento não tem fuso: formatamos em UTC
 * para não virar o dia anterior no horário de Brasília.
 */
const dateFormat = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });
export function formatReleaseDate(date: string): string {
  return dateFormat.format(new Date(`${date}T00:00:00Z`));
}

export function releaseYear(date: string | null): string | null {
  return date ? date.slice(0, 4) : null;
}

/** Instante (ISO) no fuso de quem está vendo: "01/10/2026". */
export function formatDay(isoInstant: string): string {
  return new Date(isoInstant).toLocaleDateString('pt-BR');
}

/** "Ana Souza" → "AS"; "kaike" → "K". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0][0], parts[parts.length - 1][0]] : [parts[0]?.[0]];
  return letters.join('').toUpperCase();
}

/** Aceita só caminhos internos em `?next=` (evita redirecionar para outro site). */
export function safeNextPath(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

/** Cheia, meia ou vazia para a estrela `star`, com a nota arredondada para o meio ponto. */
export function starFill(value: number, star: number): 'full' | 'half' | 'empty' {
  const rounded = Math.round(value * 2) / 2;
  if (rounded >= star) {
    return 'full';
  }
  return rounded >= star - 0.5 ? 'half' : 'empty';
}
