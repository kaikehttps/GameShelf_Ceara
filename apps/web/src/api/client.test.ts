import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '../test/render';
import {
  api,
  API_UNREACHABLE,
  API_URL,
  ApiError,
  endSession,
  onSessionChange,
  refreshSession,
  startSession,
} from './client';
import type { AuthResponse } from './types';

const auth = (accessToken: string): AuthResponse => ({
  accessToken,
  tokenType: 'Bearer',
  expiresIn: 900,
  user: {
    id: 'u1',
    email: 'demo@gameshelf.dev',
    displayName: 'Demo',
    bio: null,
    createdAt: '2026-10-01T00:00:00.000Z',
  },
});

const fetchMock = vi.fn<typeof fetch>();
const urlOf = (input: RequestInfo | URL) =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
const authorizationOf = (call: number) =>
  (fetchMock.mock.calls[call][1]?.headers as Record<string, string>).Authorization;

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  endSession();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('cliente da API', () => {
  it('envia o access token da sessão e o cookie (credentials: include)', async () => {
    startSession(auth('token-1'));
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    await expect(api('/library')).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/library`,
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(authorizationOf(0)).toBe('Bearer token-1');
  });

  it('com o access token expirado, renova a sessão uma vez e repete a chamada', async () => {
    startSession(auth('expirado'));
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { message: 'Access token inválido ou expirado' }))
      .mockResolvedValueOnce(jsonResponse(200, auth('novo')))
      .mockResolvedValueOnce(jsonResponse(200, { items: [] }));

    await expect(api('/library')).resolves.toEqual({ items: [] });

    expect(fetchMock.mock.calls[1][0]).toBe(`${API_URL}/auth/refresh`);
    expect(authorizationOf(2)).toBe('Bearer novo');
  });

  it('várias chamadas expiradas ao mesmo tempo disparam uma única renovação', async () => {
    startSession(auth('expirado'));
    fetchMock.mockImplementation((input, init) => {
      const url = urlOf(input);
      if (url.endsWith('/auth/refresh')) {
        return Promise.resolve(jsonResponse(200, auth('novo')));
      }
      const authorization = (init?.headers as Record<string, string>).Authorization;
      return Promise.resolve(
        authorization === 'Bearer novo' ? jsonResponse(200, { url }) : jsonResponse(401, {}),
      );
    });

    await Promise.all([api('/a'), api('/b'), api('/c')]);

    const refreshes = fetchMock.mock.calls.filter(([input]) =>
      urlOf(input).endsWith('/auth/refresh'),
    );
    expect(refreshes).toHaveLength(1);
  });

  it('se a renovação for recusada, encerra a sessão e repassa o 401', async () => {
    const listener = vi.fn();
    const unsubscribe = onSessionChange(listener);
    startSession(auth('expirado'));
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { message: 'Access token inválido ou expirado' }))
      .mockResolvedValueOnce(jsonResponse(401, { message: 'Sessão inválida' }));

    await expect(api('/library')).rejects.toMatchObject({ status: 401 });

    expect(listener).toHaveBeenLastCalledWith(null);
    unsubscribe();
  });

  it('sem sessão restaurável, refreshSession devolve null', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { message: 'Sessão inválida' }));

    await expect(refreshSession()).resolves.toBeNull();
  });

  it('API fora do ar vira ApiError com status 0 e mensagem clara', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const error = await api('/games').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 0, message: API_UNREACHABLE });
  });

  it('junta as mensagens de validação e traduz o 429', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(400, { message: ['rating must be an integer', 'x'] }))
      .mockResolvedValueOnce(jsonResponse(429, { message: 'ThrottlerException' }));

    await expect(api('/x')).rejects.toThrow('rating must be an integer; x');
    await expect(api('/x')).rejects.toThrow(/Muitas tentativas/);
  });

  it('204 não tem corpo', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(api('/library/1', { method: 'DELETE' })).resolves.toBeUndefined();
  });
});
