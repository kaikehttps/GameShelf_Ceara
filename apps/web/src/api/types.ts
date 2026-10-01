/** Formatos de resposta da API (espelham os DTOs documentados no Swagger). */

export type LibraryStatus = 'WANT_TO_PLAY' | 'PLAYING' | 'COMPLETED' | 'ABANDONED';
export type CatalogProvider = 'STEAM' | 'EPIC' | 'LAUNCHBOX';
export type GameSort = 'name' | 'releaseDate' | 'rating' | 'createdAt';
export type SortOrder = 'asc' | 'desc';

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  bio: string | null;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: User;
}

export interface Taxonomy {
  slug: string;
  name: string;
}

export interface RatingSummary {
  /** 1 a 5 com duas casas; null sem avaliações. */
  average: number | null;
  count: number;
}

export interface GameSummary {
  id: string;
  name: string;
  coverUrl: string | null;
  bannerUrl: string | null;
  stores: CatalogProvider[];
  /** "AAAA-MM-DD" */
  releaseDate: string | null;
  genres: Taxonomy[];
  platforms: Taxonomy[];
  rating: RatingSummary;
}

export interface ExternalId {
  provider: CatalogProvider;
  externalId: string;
  storeUrl: string | null;
}

export interface GameDetail extends GameSummary {
  description: string | null;
  externalIds: ExternalId[];
  updatedAt: string;
}

export interface LibraryEntry {
  game: GameSummary;
  status: LibraryStatus;
  addedAt: string;
  updatedAt: string;
}

export interface LibraryGameStatus {
  gameId: string;
  status: LibraryStatus;
}

export interface Review {
  id: string;
  rating: number;
  comment: string | null;
  author: { id: string; displayName: string };
  createdAt: string;
  updatedAt: string;
}
