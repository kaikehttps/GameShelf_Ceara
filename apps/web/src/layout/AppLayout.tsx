import { Outlet } from 'react-router';
import { Sidebar } from './Sidebar';

/** Estrutura do protótipo: sidebar fixa à esquerda e a página ao lado, com rolagem própria. */
export function AppLayout() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-app-bg text-app-text">
      <Sidebar />
      <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
