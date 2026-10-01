import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { listGames, listLibrary } from '../api/endpoints';
import { useAuth } from '../auth/useAuth';
import { Icon } from '../components/Icon';
import { Logo } from '../components/Logo';
import { initials } from '../lib/format';

function Count({ value }: { value: number | undefined }) {
  if (value === undefined) {
    return null;
  }
  return (
    <span className="hidden rounded border border-app-border bg-app-card px-1.5 py-0.5 text-[11px] font-medium text-app-muted lg:inline">
      {value.toLocaleString('pt-BR')}
    </span>
  );
}

function MenuLink({
  to,
  icon,
  label,
  end,
  count,
  activePrefix,
}: {
  to: string;
  icon: string;
  label: string;
  end?: boolean;
  count?: ReactNode;
  /** Também fica ativo nas rotas que começam assim (ex.: /jogos/... é parte do catálogo). */
  activePrefix?: string;
}) {
  const { pathname } = useLocation();
  const isActiveFor = (isActive: boolean) =>
    isActive || (activePrefix !== undefined && pathname.startsWith(activePrefix));
  return (
    <NavLink
      to={to}
      end={end}
      title={label}
      className={({ isActive }) =>
        `flex items-center justify-between rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
          isActiveFor(isActive)
            ? 'border-l-2 border-app-accent bg-app-surface text-app-text'
            : 'text-app-muted hover:bg-app-surface hover:text-app-text'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className="flex items-center gap-3">
            <Icon
              name={icon}
              className={`text-[19px] ${isActiveFor(isActive) ? 'text-app-accent' : ''}`}
            />
            <span className="hidden lg:inline">{label}</span>
          </span>
          {count}
        </>
      )}
    </NavLink>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <p className="hidden px-3 py-2 text-[10px] font-semibold tracking-wider text-app-muted uppercase lg:block">
      {children}
    </p>
  );
}

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Só o total: pageSize=1 deixa a consulta leve.
  const catalogTotal = useQuery({
    queryKey: ['games', { pageSize: 1 }],
    queryFn: () => listGames({ pageSize: 1 }),
  });
  const libraryTotal = useQuery({
    queryKey: ['library', user?.id, 'total'],
    queryFn: () => listLibrary({ pageSize: 1 }),
    enabled: user !== null,
  });

  const handleLogout = async () => {
    await logout();
    await navigate('/');
  };

  return (
    <aside className="z-30 flex h-full w-16 shrink-0 flex-col justify-between border-r border-app-border bg-app-card lg:w-64">
      <div className="flex flex-col">
        <Link to="/" className="flex h-16 items-center border-b border-app-border px-4 lg:px-5">
          <Logo />
        </Link>

        <div className="p-2 lg:p-3">
          <SectionTitle>Menu</SectionTitle>
          <nav className="flex flex-col gap-1" aria-label="Menu principal">
            <MenuLink
              to="/"
              end
              activePrefix="/jogos/"
              icon="grid_view"
              label="Catálogo"
              count={<Count value={catalogTotal.data?.total} />}
            />
            <MenuLink
              to="/biblioteca"
              icon="sports_esports"
              label="Minha biblioteca"
              count={user && <Count value={libraryTotal.data?.total} />}
            />
          </nav>
        </div>

        <div className="px-2 pt-2 lg:px-3">
          <SectionTitle>Descobrir</SectionTitle>
          <nav className="flex flex-col gap-1" aria-label="Descobrir">
            <Link
              to="/?ordem=rating"
              title="Mais bem avaliados"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-app-muted transition-colors hover:bg-app-surface hover:text-app-text"
            >
              <Icon name="star" />
              <span className="hidden lg:inline">Mais bem avaliados</span>
            </Link>
            <Link
              to="/?ordem=releaseDate"
              title="Lançamentos"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-app-muted transition-colors hover:bg-app-surface hover:text-app-text"
            >
              <Icon name="new_releases" />
              <span className="hidden lg:inline">Lançamentos</span>
            </Link>
          </nav>
        </div>
      </div>

      <div className="border-t border-app-border p-2 lg:p-3">
        {user ? (
          <div className="flex items-center justify-center gap-2 rounded-lg p-2 lg:justify-between">
            <div className="hidden min-w-0 items-center gap-3 lg:flex">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-app-border bg-app-surface text-xs font-semibold text-app-accent"
                title={user.displayName}
              >
                {initials(user.displayName)}
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-semibold">{user.displayName}</span>
                <span className="truncate text-[11px] text-app-muted">{user.email}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Sair"
              aria-label="Sair"
              className="rounded p-1 text-app-muted transition-colors hover:text-app-text"
            >
              <Icon name="logout" />
            </button>
          </div>
        ) : (
          <Link to="/entrar" className="btn-primary w-full" title="Entrar">
            <Icon name="login" className="text-[16px]" />
            <span className="hidden lg:inline">Entrar</span>
          </Link>
        )}
      </div>
    </aside>
  );
}
