import type { AuthResponse, User } from './types';

export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

/** Erro da API. `status` 0 significa que a API não respondeu (fora do ar, sem rede). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const API_UNREACHABLE = 'Não foi possível falar com a API. Confira se ela está rodando.';

/*
 * Sessão no navegador:
 * - O access token (JWT de 15 min) fica só na memória deste módulo, nunca no
 *   localStorage: um script injetado na página não consegue lê-lo depois de um reload.
 * - O refresh token fica no cookie httpOnly que a API define; o JavaScript não o vê.
 *   Ao abrir a página, `refreshSession()` usa esse cookie para obter um novo access token.
 */
let accessToken: string | null = null;
let refreshInFlight: Promise<AuthResponse | null> | null = null;
const listeners = new Set<(user: User | null) => void>();

export function onSessionChange(listener: (user: User | null) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function startSession(auth: AuthResponse): void {
  accessToken = auth.accessToken;
  listeners.forEach((listener) => listener(auth.user));
}

export function endSession(): void {
  accessToken = null;
  listeners.forEach((listener) => listener(null));
}

/**
 * Troca o cookie de refresh por um novo access token. Só uma chamada por vez: a API
 * rotaciona o refresh token a cada uso, então duas renovações simultâneas com o mesmo
 * cookie fariam a segunda ser recusada (e aquela aba sairia da conta).
 * - Na mesma aba: as chamadas compartilham a mesma Promise (`refreshInFlight`).
 * - Entre abas: a Web Locks API enfileira as renovações; a segunda aba já envia o
 *   cookie novo que a primeira recebeu.
 */
export function refreshSession(): Promise<AuthResponse | null> {
  refreshInFlight ??= withCrossTabLock(async () => {
    try {
      const res = await fetchOrThrow(`${API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        endSession();
        return null;
      }
      const auth = (await res.json()) as AuthResponse;
      startSession(auth);
      return auth;
    } finally {
      refreshInFlight = null;
    }
  });
  return refreshInFlight;
}

const REFRESH_LOCK = 'gameshelf-refresh';

function withCrossTabLock<T>(task: () => Promise<T>): Promise<T> {
  // Navegadores atuais têm Web Locks; sem suporte (ex.: jsdom nos testes), executa direto.
  return 'locks' in navigator ? navigator.locks.request(REFRESH_LOCK, task) : task();
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

/** Chamada à API com JSON e access token. Se o token expirou, renova uma vez e repete. */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const send = () =>
    fetchOrThrow(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      // O cookie de refresh só vai para /auth (Path=/auth); nas outras rotas não há cookie.
      credentials: 'include',
      headers: {
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });

  const usedToken = accessToken !== null;
  let res = await send();
  if (res.status === 401 && usedToken && !path.startsWith('/auth/')) {
    const renewed = await refreshSession();
    if (renewed) {
      res = await send();
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, await readErrorMessage(res));
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

async function fetchOrThrow(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (error) {
    // Cancelamento (troca de página, nova busca) não é erro da API.
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    throw new ApiError(0, API_UNREACHABLE);
  }
}

/** O Nest responde `{ message: string | string[] }`; validação traz uma lista. */
async function readErrorMessage(res: Response): Promise<string> {
  if (res.status === 429) {
    return 'Muitas tentativas seguidas. Aguarde um minuto e tente de novo.';
  }
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) {
      return body.message.join('; ');
    }
    if (body.message) {
      return body.message;
    }
  } catch {
    // Corpo vazio ou que não é JSON: usa a mensagem genérica abaixo.
  }
  return res.status >= 500
    ? 'A API encontrou um erro inesperado. Tente de novo em instantes.'
    : `A requisição falhou (HTTP ${res.status}).`;
}
