import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { useAuth } from '../auth/useAuth';
import { Icon } from '../components/Icon';
import { safeNextPath } from '../lib/format';

/** Conta pública criada pelo seed da API (npm run db:seed). */
const DEMO_ACCOUNT = { email: 'demo@gameshelf.dev', password: 'demo-password-123' };
const PASSWORD_MIN_LENGTH = 15;
const PASSWORD_HINT_ID = 'password-hint';

export function LoginPage({ mode }: { mode: 'login' | 'register' }) {
  const { user, loading, login, register } = useAuth();
  const [params] = useSearchParams();
  const next = safeNextPath(params.get('next'));
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Já logado (ou acabou de logar): segue para onde ia.
  if (!loading && user) {
    return <Navigate to={next} replace />;
  }

  const isLogin = mode === 'login';
  const nextQuery = next === '/' ? '' : `?next=${encodeURIComponent(next)}`;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(displayName, email, password);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Algo deu errado. Tente de novo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-app-bg px-4 py-10">
      <img src="/logo.png" alt="GameShelf Ceará" className="mb-8 w-56 sm:w-64" />

      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-app-border bg-app-card p-6 shadow-sm"
      >
        <div>
          <h1 className="text-lg font-bold">{isLogin ? 'Entrar' : 'Criar conta'}</h1>
          <p className="mt-1 text-xs text-app-muted">
            {isLogin
              ? 'Acesse sua biblioteca e suas avaliações.'
              : 'Organize seus jogos e avalie o que já jogou.'}
          </p>
        </div>

        {!isLogin && (
          <Field label="Nome de exibição">
            <input
              className="input"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              required
              minLength={2}
              maxLength={50}
              autoComplete="nickname"
            />
          </Field>
        )}
        <Field label="E-mail">
          <input
            className="input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            maxLength={254}
            autoComplete="email"
          />
        </Field>
        <Field
          label="Senha"
          hint={
            isLogin
              ? undefined
              : {
                  id: PASSWORD_HINT_ID,
                  text: `Mínimo de ${PASSWORD_MIN_LENGTH} caracteres. Frases longas são ótimas.`,
                }
          }
        >
          <input
            className="input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={isLogin ? undefined : PASSWORD_MIN_LENGTH}
            maxLength={128}
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            aria-describedby={isLogin ? undefined : PASSWORD_HINT_ID}
          />
        </Field>

        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md border border-app-danger/40 bg-app-danger/10 px-3 py-2 text-xs text-app-danger"
          >
            <Icon name="error" className="text-[16px]" />
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary w-full" disabled={submitting || loading}>
          {submitting ? 'Aguarde…' : isLogin ? 'Entrar' : 'Criar conta'}
        </button>

        <p className="text-center text-xs text-app-muted">
          {isLogin ? 'Ainda não tem conta? ' : 'Já tem conta? '}
          <Link
            to={`${isLogin ? '/cadastro' : '/entrar'}${nextQuery}`}
            className="font-semibold text-app-accent hover:underline"
          >
            {isLogin ? 'Criar conta' : 'Entrar'}
          </Link>
        </p>
      </form>

      {isLogin && (
        <div className="mt-4 flex w-full max-w-sm items-center justify-between gap-3 rounded-lg border border-dashed border-app-border px-4 py-3 text-xs text-app-muted">
          <span>
            Conta de demonstração:
            <br />
            <span className="text-app-text">{DEMO_ACCOUNT.email}</span>
          </span>
          <button
            type="button"
            className="btn-secondary shrink-0"
            onClick={() => {
              setEmail(DEMO_ACCOUNT.email);
              setPassword(DEMO_ACCOUNT.password);
            }}
          >
            Usar conta demo
          </button>
        </div>
      )}

      <Link to="/" className="mt-6 text-xs text-app-muted hover:text-app-text">
        ← Voltar ao catálogo
      </Link>
    </div>
  );
}

interface FieldProps {
  label: string;
  /** Texto de ajuda abaixo do campo; o input deve apontar para ele com aria-describedby. */
  hint?: { id: string; text: string };
  children: ReactNode;
}

function Field({ label, hint, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-app-muted">{label}</span>
        {children}
      </label>
      {hint && (
        <p id={hint.id} className="text-[11px] text-app-muted">
          {hint.text}
        </p>
      )}
    </div>
  );
}
