import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Icon } from '../components/Icon';
import { ToastContext, type ToastKind } from './context';

interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

const TOAST_DURATION_MS = 4000;
let nextId = 1;

/** Avisos curtos no canto da tela, para o resultado de ações (adicionar, avaliar...). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = nextId++;
    setToasts((current) => [...current, { id, message, kind }]);
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), TOAST_DURATION_MS);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext value={value}>
      {children}
      <div
        className="pointer-events-none fixed right-6 bottom-6 z-50 flex flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="flex max-w-sm items-center gap-2 rounded-lg border border-app-border bg-app-card px-4 py-3 text-sm shadow-lg"
          >
            <Icon
              name={toast.kind === 'success' ? 'check_circle' : 'error'}
              className={
                toast.kind === 'success'
                  ? 'text-[18px] text-app-accent'
                  : 'text-[18px] text-app-danger'
              }
            />
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext>
  );
}
