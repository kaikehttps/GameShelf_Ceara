import type { ReactNode } from 'react';
import { Icon } from './Icon';

export function Spinner({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div
      className="flex items-center justify-center gap-3 py-16 text-sm text-app-muted"
      role="status"
    >
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-app-border border-t-app-accent" />
      {label}
    </div>
  );
}

interface MessageProps {
  icon: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  tone?: 'neutral' | 'error';
}

function Message({ icon, title, children, action, tone = 'neutral' }: MessageProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-app-border px-6 py-14 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg border border-app-border bg-app-card">
        <Icon
          name={icon}
          className={`text-[22px] ${tone === 'error' ? 'text-app-danger' : 'text-app-muted'}`}
        />
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {children && <p className="mt-1 max-w-md text-xs text-app-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function EmptyState(props: Omit<MessageProps, 'tone'>) {
  return <Message {...props} />;
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <Message
      icon="cloud_off"
      tone="error"
      title="Não deu para carregar"
      action={
        onRetry && (
          <button type="button" onClick={onRetry} className="btn-secondary">
            <Icon name="refresh" className="text-[16px]" />
            Tentar de novo
          </button>
        )
      }
    >
      {error.message}
    </Message>
  );
}

/** Esqueleto da grade de jogos enquanto a primeira página carrega. */
export function GridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5"
      aria-hidden
    >
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="rounded-lg border border-app-border bg-app-card p-2">
          <div className="aspect-[3/4] animate-pulse rounded-md bg-app-surface" />
          <div className="mt-3 h-3 w-3/4 animate-pulse rounded bg-app-surface" />
          <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-app-surface" />
          <div className="mt-4 h-5 animate-pulse rounded bg-app-surface" />
        </div>
      ))}
    </div>
  );
}
