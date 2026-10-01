import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { endSession, onSessionChange, refreshSession, startSession } from '../api/client';
import * as endpoints from '../api/endpoints';
import type { User } from '../api/types';
import { AuthContext } from './context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<{ loading: boolean; user: User | null }>({
    loading: true,
    user: null,
  });

  useEffect(() => {
    // Qualquer mudança de sessão (login, logout, refresh recusado) chega por aqui.
    const unsubscribe = onSessionChange((user) => setState({ loading: false, user }));
    // Restaura a sessão a partir do cookie httpOnly. Sem cookie, a API responde 401.
    refreshSession().catch(() => setState({ loading: false, user: null }));
    return unsubscribe;
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    startSession(await endpoints.login(email, password));
  }, []);

  const register = useCallback(async (displayName: string, email: string, password: string) => {
    startSession(await endpoints.register(displayName, email, password));
  }, []);

  const logout = useCallback(async () => {
    try {
      await endpoints.logout();
    } finally {
      endSession();
      // Biblioteca e avaliações em cache eram do usuário anterior.
      queryClient.clear();
    }
  }, [queryClient]);

  const value = useMemo(
    () => ({ ...state, login, register, logout }),
    [state, login, register, logout],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
