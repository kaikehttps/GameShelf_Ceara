import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import type { User } from '../api/types';
import { AuthContext, type AuthContextValue } from '../auth/context';
import { ToastProvider } from '../toast/ToastProvider';

export const DEMO_USER: User = {
  id: '0199a0b2-7f3c-7a1e-9c4d-000000000001',
  email: 'demo@gameshelf.dev',
  displayName: 'Conta Demo',
  bio: null,
  createdAt: '2026-10-01T12:00:00.000Z',
};

/** Mostra a rota atual, para os testes conferirem redirecionamentos. */
function CurrentLocation() {
  const location = useLocation();
  return <p data-testid="location">{location.pathname + location.search}</p>;
}

interface Options {
  route?: string;
  /** Padrão de rota onde a tela é montada; as demais rotas ficam vazias. */
  path?: string;
  /** Sessão simulada. Sem `auth`, usa um contexto sem login. */
  auth?: Partial<AuthContextValue>;
}

/** Renderiza com React Query, rotas em memória, avisos e uma sessão simulada. */
export function renderWithProviders(
  ui: ReactElement,
  { route = '/', path = '*', auth = {} }: Options = {},
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const authValue: AuthContextValue = {
    loading: false,
    user: null,
    login: () => Promise.resolve(),
    register: () => Promise.resolve(),
    logout: () => Promise.resolve(),
    ...auth,
  };
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <ToastProvider>
          <AuthContext value={authValue}>
            <Routes>
              <Route path={path} element={ui} />
              {path !== '*' && <Route path="*" element={null} />}
            </Routes>
            <CurrentLocation />
          </AuthContext>
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Resposta JSON para simular a API em `fetch`. */
export function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
