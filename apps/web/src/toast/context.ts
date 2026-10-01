import { createContext, use } from 'react';

export type ToastKind = 'success' | 'error';

export interface ToastContextValue {
  showToast: (message: string, kind?: ToastKind) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const context = use(ToastContext);
  if (!context) {
    throw new Error('useToast precisa estar dentro de <ToastProvider>');
  }
  return context;
}
