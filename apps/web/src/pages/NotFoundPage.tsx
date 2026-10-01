import { Link } from 'react-router';
import { EmptyState } from '../components/States';
import { PageHeader } from '../layout/PageHeader';

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Página não encontrada" />
      <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
        <EmptyState
          icon="explore_off"
          title="Esta página não existe"
          action={
            <Link to="/" className="btn-secondary">
              Ir para o catálogo
            </Link>
          }
        >
          Confira o endereço ou volte ao catálogo.
        </EmptyState>
      </main>
    </>
  );
}
