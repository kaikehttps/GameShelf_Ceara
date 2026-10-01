import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: ReactNode;
  /** Texto curto ao lado do título, ex.: "12 jogos disponíveis". */
  subtitle?: ReactNode;
  /** Busca e ações à direita. */
  children?: ReactNode;
}

export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <header className="z-20 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-app-border bg-app-bg/95 px-4 backdrop-blur md:px-8">
      <div className="flex min-w-0 items-center gap-4">
        <h1 className="truncate text-xl font-bold tracking-tight">{title}</h1>
        {subtitle && (
          <>
            <span className="hidden h-4 w-px bg-app-border sm:block" />
            <span className="hidden text-xs font-medium whitespace-nowrap text-app-muted sm:block">
              {subtitle}
            </span>
          </>
        )}
      </div>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </header>
  );
}
