import { Route, Routes } from 'react-router';
import { RequireAuth } from './auth/RequireAuth';
import { AppLayout } from './layout/AppLayout';
import { CatalogPage } from './pages/CatalogPage';
import { GameDetailsPage } from './pages/GameDetailsPage';
import { LibraryPage } from './pages/LibraryPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';

export function App() {
  return (
    <Routes>
      <Route path="/entrar" element={<LoginPage mode="login" />} />
      <Route path="/cadastro" element={<LoginPage mode="register" />} />
      <Route element={<AppLayout />}>
        <Route index element={<CatalogPage />} />
        <Route path="jogos/:id" element={<GameDetailsPage />} />
        <Route
          path="biblioteca"
          element={
            <RequireAuth>
              <LibraryPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
