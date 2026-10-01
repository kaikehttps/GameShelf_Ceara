import { createContext } from 'react';
import type { User } from '../api/types';

export interface AuthContextValue {
  /** true enquanto a sessão salva no cookie ainda está sendo restaurada. */
  loading: boolean;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (displayName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
