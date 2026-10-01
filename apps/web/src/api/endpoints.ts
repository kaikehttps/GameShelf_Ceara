import { api } from './client';
import type {
  AuthResponse,
  GameDetail,
  GameSort,
  GameSummary,
  LibraryEntry,
  LibraryGameStatus,
  LibraryStatus,
  Page,
  Review,
  SortOrder,
  Taxonomy,
} from './types';

/** Monta a query string, ignorando valores vazios. */
function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

// ---- Autenticação ----

export const login = (email: string, password: string) =>
  api<AuthResponse>('/auth/login', { method: 'POST', body: { email, password } });

export const register = (displayName: string, email: string, password: string) =>
  api<AuthResponse>('/auth/register', { method: 'POST', body: { displayName, email, password } });

export const logout = () => api<void>('/auth/logout', { method: 'POST' });

// ---- Catálogo ----

export interface GameListParams {
  q?: string;
  genre?: string;
  platform?: string;
  sort?: GameSort;
  order?: SortOrder;
  page?: number;
  pageSize?: number;
}

export const listGames = (params: GameListParams, signal?: AbortSignal) =>
  api<Page<GameSummary>>(`/games${query({ ...params })}`, { signal });

export const getGame = (id: string, signal?: AbortSignal) =>
  api<GameDetail>(`/games/${encodeURIComponent(id)}`, { signal });

export const listGenres = () => api<Taxonomy[]>('/genres');
export const listPlatforms = () => api<Taxonomy[]>('/platforms');

// ---- Biblioteca ----

export const listLibrary = (params: { status?: LibraryStatus; page?: number; pageSize?: number }) =>
  api<Page<LibraryEntry>>(`/library${query(params)}`);

export const libraryStatusOf = (gameIds: string[]) =>
  api<LibraryGameStatus[]>(`/library/status${query({ gameIds: gameIds.join(',') })}`);

export const addToLibrary = (gameId: string, status?: LibraryStatus) =>
  api<LibraryEntry>('/library', { method: 'POST', body: { gameId, status } });

export const updateLibraryStatus = (gameId: string, status: LibraryStatus) =>
  api<LibraryEntry>(`/library/${encodeURIComponent(gameId)}`, {
    method: 'PATCH',
    body: { status },
  });

export const removeFromLibrary = (gameId: string) =>
  api<void>(`/library/${encodeURIComponent(gameId)}`, { method: 'DELETE' });

// ---- Avaliações ----

const reviewsPath = (gameId: string) => `/games/${encodeURIComponent(gameId)}/reviews`;

export const listReviews = (gameId: string, page: number, pageSize = 10) =>
  api<Page<Review>>(`${reviewsPath(gameId)}${query({ page, pageSize })}`);

export const getMyReview = (gameId: string) => api<Review>(`${reviewsPath(gameId)}/me`);

export const createReview = (gameId: string, rating: number, comment: string) =>
  api<Review>(reviewsPath(gameId), { method: 'POST', body: { rating, comment } });

export const updateMyReview = (gameId: string, rating: number, comment: string) =>
  api<Review>(`${reviewsPath(gameId)}/me`, { method: 'PATCH', body: { rating, comment } });

export const deleteMyReview = (gameId: string) =>
  api<void>(`${reviewsPath(gameId)}/me`, { method: 'DELETE' });
