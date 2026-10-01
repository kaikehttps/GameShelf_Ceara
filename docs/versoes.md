# Matriz de versões

Levantada em **01/10/2026** no registro do npm (`npm view <pacote> version engines peerDependencies`),
nas notas de versão e na documentação oficial de cada projeto. As escolhas abaixo valem para a etapa 1;
as linhas marcadas como "etapa N" foram verificadas, mas só entram no projeto quando forem usadas.

## Runtime e linguagem

| Item | Versão | Por quê |
|---|---|---|
| Node.js | **24 LTS** (24.21.0) | Node 20 saiu de suporte em 30/04/2026. O CLI do Nest 12 (`@nestjs/schematics`) exige `^24.15`, e o Testcontainers 12 exige `>=22.22`. O Node 26 só vira LTS em 28/10/2026. |
| TypeScript | **~6.0.3** | O `latest` do npm é o 7.0 (compilador nativo em Go), que **ainda não tem API JS**: quebra typescript-eslint (`<6.1.0`) e conflita com o peer do `@nestjs/swagger` (`^5.5 \|\| ^6`). O `~` impede subir para um eventual 6.1. |
| Módulos | **ESM** (`"type": "module"`) | Os pacotes do Nest 12 são ESM-only, e o template oficial ESM do Nest 12 usa Vitest. O Prisma 7 também tem ESM como caminho principal. |

## API (apps/api)

| Pacote | Faixa | Observação |
|---|---|---|
| `@nestjs/core`, `common`, `platform-express`, `testing` | ^12.1.2 | 12.1 trouxe `enableCsrfProtection()`, `useSecurityHeaders()` e `@Cookies()`, que substituem `helmet` e `cookie-parser`. |
| `@nestjs/config` | ^12.0.1 | A numeração pulou de 4.x para 12.x (a 4.x não aceita Nest 12). |
| `@nestjs/jwt` | ^12.0.2 | `expiresIn` numérico = segundos. |
| `@nestjs/swagger` | ^12.0.2 | Peer de TypeScript `^5.5 \|\| ^6`. |
| `@nestjs/throttler` | ^6.7.1 | 6.7.1 é a primeira com a correção de compatibilidade com o Nest 12. `ttl` em milissegundos. |
| `prisma`, `@prisma/client`, `@prisma/adapter-pg` | **7.10.0 (exato)** | **Armadilha:** o dist-tag `latest` do pacote `prisma` aponta para `8.0.0-rc.19`, um produto reescrito. Nunca rode `npm i prisma` ou `npx prisma` sem versão. Os três pacotes precisam ter a mesma versão. |
| `@node-rs/argon2` | ^2.2.1 | Binários pré-compilados (napi-rs) para Windows, glibc e musl; sem node-gyp. |
| `class-validator` / `class-transformer` | ^0.15.1 / ^0.5.1 | Versões abaixo de 0.14 do class-validator têm vulnerabilidade crítica. |
| `vitest` + `@vitest/coverage-v8` | ^4.1.11 | Vitest 5 tem 4 semanas e o `unplugin-swc` foi testado com a 4.1. O coverage exige a **mesma** versão do vitest. |
| `unplugin-swc` + `@swc/core` | ^2.0.0 / ^1.16.13 | Gera `emitDecoratorMetadata` nos testes (necessário para a injeção de dependências do Nest). |
| `@testcontainers/postgresql` | ^12.2.0 | Exige Node `>=22.22`. A imagem precisa ser informada explicitamente. |
| `eslint` + `typescript-eslint` | ^10.11.0 / ^8.71.0 | ESLint 10 só aceita flat config. |
| `dotenv` | ^17.4.2 | Apenas no `prisma.config.ts`: o CLI do Prisma 7 não carrega `.env` sozinho. |

## Infraestrutura

| Item | Versão | Observação |
|---|---|---|
| PostgreSQL | `postgres:18.6-alpine` | **Mudança na imagem 18:** o volume vai em `/var/lib/postgresql` (não mais `/data`). A mesma imagem é usada no Compose, na CI e no Testcontainers. |
| Imagem da API | `node:24.21.0-bookworm-slim` | Debian em vez de Alpine: o schema engine do Prisma 7 (usado no `migrate`) teve problemas com musl. |
| GitHub Actions | `checkout@v7`, `setup-node@v7`, `ubuntu-24.04` | Runner fixo: o `ubuntu-latest` migra para 26.04 entre outubro e novembro de 2026. |
| npm | 11.19 (vem com o Node 24.21) | Scripts de instalação precisam de aprovação em `allowScripts` no `package.json`. Aprovados: `prisma`, `@prisma/engines` (baixa o schema engine), `@swc/core`, `esbuild`. Negados: `@scarf/scarf` (telemetria), `protobufjs` e `ssh2` (build nativo opcional). |

## Frontend (apps/web)

Levantado em 01/10/2026 no registro do npm.

| Pacote | Faixa | Observação |
|---|---|---|
| `vite` | ^8.3.2 | Exige Node `^20.19 \|\| >=22.12`. |
| `@vitejs/plugin-react` | ^6.1.1 | Peer `vite ^8`. |
| `react`, `react-dom` | ^19.3.0 | |
| `react-router` | ^8.4.0 | O v8 removeu o pacote `react-router-dom` (tudo vem de `react-router`) e exige Node `>=22.22` e React `>=19.2.7`. Usamos o modo declarativo (`<BrowserRouter>`, `<Routes>`). |
| `@tanstack/react-query` | ^5.104.0 | |
| `tailwindcss` + `@tailwindcss/vite` | ^4.3.3 | Configuração no CSS (`@theme`), sem `tailwind.config.js`. |
| `typescript` | ~6.0.3 | Mesmo motivo da API: o TypeScript 7 quebra o `typescript-eslint`. |
| `vitest` | ^4.1.11 | Mesma versão da API. O Vitest 5 existe, mas a 4.1 aceita o Vite 8 (`peer vite ^6 \|\| ^7 \|\| ^8`). |
| `jsdom` | ^30.1.1 | Ambiente dos testes de componentes. |
| `@testing-library/react` + `jest-dom` + `user-event` | ^16.3 / ^7.0 / ^14.6 | |

## Recursos do PostgreSQL usados na etapa 2

Verificados em 01/10/2026 no PostgreSQL 18.4 local e no Dockerfile oficial da imagem `postgres:18.6-alpine` (`docker-library/postgres`, `18/alpine3.23`).

| Recurso | Requisito | Observação |
|---|---|---|
| Extensão `pg_trgm` | módulo *contrib*, presente nas imagens oficiais | Extensão *trusted* desde o PostgreSQL 13: o dono do banco a cria sem ser superusuário. A migration usa `CREATE EXTENSION IF NOT EXISTS`. |
| Collation `und-x-icu` | PostgreSQL compilado com ICU | A imagem oficial usa `--with-icu` e instala `icu-data-full`. Sem ICU, a migration da etapa 2 falha ao criar as tabelas. |
| Trigger em PL/pgSQL | nativo | Nenhuma extensão adicional. |

## Próximas etapas (verificado, ainda não instalado)

| Item | Versão sugerida | Observação |
|---|---|---|
| Redis para BullMQ (etapa 3) | `redis:7.4-alpine` ou `valkey/valkey:8-alpine` | É o que a CI do BullMQ testa. Redis 8 atende o mínimo (6.2), mas não está na matriz de testes do BullMQ. |
| `bullmq` + `ioredis` (etapa 3) | 6.x + **ioredis ^5** | BullMQ 6 não traz mais o ioredis embutido e é testado com a versão 5. |
| Elasticsearch (etapa 4) | servidor `9.5.4` + cliente `~9.5.1` | O cliente e o servidor precisam ter a mesma versão major. Não existe tag flutuante (`latest`/`9`). |
| OpenObserve (etapa 5) | `public.ecr.aws/zinclabs/openobserve:v1.0.4` | Imagem distroless (sem curl para healthcheck); a senha root precisa ser forte. |
| Prometheus (etapa 5) | `prom/prometheus:v3.13.4` (LTS) | |
| ClickHouse (etapa 7) | `clickhouse/clickhouse-server:26.8` (LTS) | |
| Sentry + New Relic (etapa 5) | um único responsável pelo tracing | Os dois instrumentam o carregamento de módulos; New Relic fica desligado por padrão. |
