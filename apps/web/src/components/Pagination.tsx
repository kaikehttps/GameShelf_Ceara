import { Icon } from './Icon';

interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }
  return (
    <nav className="flex items-center justify-center gap-3 pt-2" aria-label="Paginação">
      <button
        type="button"
        className="btn-secondary"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        <Icon name="chevron_left" className="text-[16px]" />
        Anterior
      </button>
      <span className="text-xs text-app-muted">
        Página <span className="font-medium text-app-text">{page}</span> de {totalPages}
      </span>
      <button
        type="button"
        className="btn-secondary"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Próxima
        <Icon name="chevron_right" className="text-[16px]" />
      </button>
    </nav>
  );
}
