import { execSync } from 'node:child_process';
import type { TestProject } from 'vitest/node';

/**
 * Prepara um PostgreSQL real para os testes de integração/e2e.
 *
 * - Se TEST_DATABASE_URL estiver definida, usa esse banco (útil sem Docker).
 *   ATENÇÃO: os testes apagam os dados desse banco; use um banco descartável.
 * - Caso contrário, sobe um container descartável com Testcontainers.
 *
 * Em seguida aplica as migrations versionadas, exatamente como em produção.
 */
export default async function setup(project: TestProject) {
  let databaseUrl = process.env.TEST_DATABASE_URL;
  let stopContainer: (() => Promise<unknown>) | undefined;

  if (!databaseUrl) {
    const { PostgreSqlContainer } = await import('@testcontainers/postgresql');
    // Mesma imagem do docker-compose.yml e da CI.
    const container = await new PostgreSqlContainer('postgres:18.6-alpine').start();
    databaseUrl = container.getConnectionUri();
    stopContainer = () => container.stop();
  }

  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });

  project.provide('databaseUrl', databaseUrl);

  return async () => {
    await stopContainer?.();
  };
}

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}
