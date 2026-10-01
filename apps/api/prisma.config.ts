import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// O CLI do Prisma 7 não carrega arquivos .env sozinho. Lemos o .env local (se existir)
// e o da raiz do repositório. Variáveis já definidas no ambiente têm prioridade.
config({ path: ['.env', '../../.env'], quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  // process.env (e não env()) para que `prisma generate` funcione sem banco, por exemplo no build do Docker.
  datasource: { url: process.env.DATABASE_URL },
});
