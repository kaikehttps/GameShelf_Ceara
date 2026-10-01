<p align="center">
  <img src="assets/logo.png" alt="Logo do GameShelf Ceará" width="220" />
</p>

<h1 align="center">GameShelf Ceará</h1>

<p align="center">
  Catálogo, biblioteca pessoal, avaliações e base para downloads via torrent de jogos e arquivos de distribuição autorizada.
</p>

<p align="center">
  <img src="assets/hydra.png" alt="Logo da Hydra" width="96" />
  <br />
  <strong>Projeto de portfólio para candidatura à Hydra</strong>
  <br />
  <sub>Projeto independente de portfólio, sem vínculo oficial com a Hydra.</sub>
</p>

<p align="center">
  <img alt="Node.js 24" src="https://img.shields.io/badge/Node.js-24-35C990" />
  <img alt="NestJS 12" src="https://img.shields.io/badge/NestJS-12-35C990" />
  <img alt="React 19" src="https://img.shields.io/badge/React-19-35C990" />
  <img alt="PostgreSQL 18" src="https://img.shields.io/badge/PostgreSQL-18-35C990" />
</p>

## Por que quero fazer parte da Hydra

Meu nome é **Kaike Ferreira Alves**. Videogames são meu hobby favorito e uma parte importante da minha vida. Se não fosse pela democratização do acesso aos jogos, esse contato não teria acontecido tão cedo.

Eu me identifico com a ideia de tornar a descoberta e a instalação de jogos mais acessíveis, principalmente para quem não tem familiaridade ou segurança para navegar por sites de distribuição. Hoje, como desenvolvedor, quero usar minhas habilidades para facilitar esse acesso e melhorar a experiência de outros jogadores.

Tenho muita vontade de trabalhar na Hydra, aprender com a equipe e ajudar na missão do produto. Criei o GameShelf para me aproximar dos desafios técnicos apresentados na vaga e demonstrar minha disposição de construir, aprender e contribuir.

## O que o projeto faz

O GameShelf Ceará é um monorepo com uma API NestJS e uma interface React para organizar jogos em um catálogo demonstrativo. O usuário consegue criar conta, entrar, navegar pelo catálogo, pesquisar, filtrar, ver detalhes, manter uma biblioteca pessoal e avaliar jogos.

O backend também já contém um módulo de downloads via BitTorrent controlado pela API, usando fontes previamente cadastradas e um cliente qBittorrent externo. Esse módulo foi inspecionado e passou por typecheck/lint junto com a API, mas ainda não tem testes específicos nem validação local com qBittorrent real nesta revisão.

## Funcionalidades e status atual

### Implementado e validado localmente

| Área                    | Status                                                                                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Autenticação            | Cadastro, login, refresh token rotativo, logout, guard global, rate limit e proteção CSRF configurados.                                         |
| Perfil                  | `GET /users/me` e `PATCH /users/me`.                                                                                                            |
| Catálogo                | Listagem pública, busca por nome, filtros por gênero/plataforma, ordenação e paginação.                                                         |
| Detalhes do jogo        | Dados do jogo, gêneros, plataformas, identificadores externos, link oficial quando conhecido, média e quantidade de avaliações.                 |
| Biblioteca pessoal      | Adicionar, listar, alterar status e remover jogos da própria biblioteca.                                                                        |
| Avaliações              | Criar, listar, editar e excluir avaliação própria; média mantida por trigger no PostgreSQL.                                                     |
| Frontend                | Login, cadastro, catálogo, detalhes do jogo, biblioteca, avaliações e estados de carregamento/erro.                                             |
| Qualidade nesta revisão | API: Prettier, ESLint, typecheck e 27 testes unitários passaram com Node 24. Web: Prettier, ESLint, typecheck e 24 testes passaram com Node 24. |

### Implementado, mas depende de Docker, credenciais ou serviços externos

| Área                                   | Status                                                                                                                                                                                             |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Docker Compose básico                  | `postgres`, `migrate` e `api` estão configurados. `docker compose config` passou com `JWT_ACCESS_SECRET` dummy. Os containers não foram iniciados nesta revisão.                                   |
| Testes e2e                             | Existem arquivos em `apps/api/test/*.e2e-spec.ts`, mas `npm run test:e2e` não foi validado porque o Testcontainers não encontrou runtime Docker ativo e não havia `TEST_DATABASE_URL` configurado. |
| Downloads via torrent na API           | Rotas, modelos Prisma, monitor, estado em memória/Redis e cliente qBittorrent existem. Sem `QBT_URL`, operações de download respondem 503 e o restante da API continua separado por configuração.  |
| Redis para estado ao vivo de downloads | Implementação com `ioredis` existe para pub/sub, snapshots e trava do monitor, mas depende de `REDIS_URL`. Não há serviço Redis no Compose atual.                                                  |
| qBittorrent                            | Cliente Web API v2 implementado para login por cookie, `Referer`, timeout, retry e rotas `stop/start/delete/add`. Depende de `QBT_URL` e credenciais.                                              |

### Não implementado

| Área                                                     | Status                                                                                                                                                              |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend de downloads                                    | Não há página `/downloads`, botão "Baixar via torrent", item de menu ou faixa de download ativo no rodapé.                                                          |
| Scripts CLI de downloads                                 | Não existem scripts `downloads:add-source`, `set-source-active` ou `make-test-torrent`.                                                                             |
| Perfil Docker `torrent`                                  | O `docker-compose.yml` ainda não inclui qBittorrent, Redis, volume de downloads ou perfil torrent.                                                                  |
| `.env.example` para downloads                            | O arquivo atual ainda não documenta `QBT_URL`, `QBT_USERNAME`, `QBT_PASSWORD`, `QBT_SAVE_ROOT`, `DOWNLOADS_DIR`, `REDIS_URL` e variáveis relacionadas.              |
| Testes unitários do módulo de downloads                  | Não foram encontrados testes para bencode, metadata de torrent, estado de torrent, diretório de tarefa ou cliente qBittorrent.                                      |
| Testes e2e de downloads                                  | Não foram encontrados testes e2e específicos para isolamento entre usuários, cliente falso, indisponibilidade, timeout, SSE, reconciliação ou exclusão de arquivos. |
| Sincronização de catálogo, cache, filas e busca avançada | Redis/BullMQ para etapa 3, Elasticsearch, observabilidade, AWS, Go e ClickHouse ainda não estão implementados.                                                      |

## Downloads via torrent

O módulo de downloads foi desenhado para a API controlar um cliente qBittorrent. O navegador não recebe magnet links, arquivos `.torrent` nem credenciais do cliente torrent.

### Como iniciar um download

O usuário autenticado inicia um download com `POST /downloads`, enviando apenas o `sourceId` de uma fonte cadastrada. As fontes públicas de um jogo ficam em `GET /games/{gameId}/download-sources` e a resposta não expõe o magnet nem o conteúdo do `.torrent`.

As fontes aceitas no modelo são:

| Tipo           | Como fica armazenado                                                      |
| -------------- | ------------------------------------------------------------------------- |
| `MAGNET`       | `reference` com link `magnet:?...`; `torrentFile` nulo.                   |
| `TORRENT_FILE` | `reference` com nome do arquivo e `torrentFile` em `BYTEA` no PostgreSQL. |

A migration `20261001194039_downloads` cria restrições para `info_hash` v1 em hex, formato de magnet, presença do arquivo `.torrent`, tamanho positivo quando conhecido, licença/origem obrigatórias, progresso entre 0 e 1 e conclusão somente com `progress = 1` e `completed_at` preenchido.

### Onde o download acontece

Os arquivos são baixados na máquina que executa o backend e o cliente qBittorrent, normalmente um volume Docker montado no ambiente local. Eles não são salvos automaticamente no computador de qualquer pessoa que acessa a interface web.

No código atual, o caminho enviado ao qBittorrent é `QBT_SAVE_ROOT/<downloadId>`. Para excluir arquivos depois de cancelar, a API precisa enxergar a mesma pasta por `DOWNLOADS_DIR`. A função de exclusão recusa caminhos fora da raiz e symlinks.

### Progresso, pausa e cancelamento

O monitor consulta os torrents com a tag `gameshelf`, grava no banco apenas mudanças de estado e checkpoints de progresso, e publica snapshots em tempo real com velocidade, tamanho, ETA, peers, seeding e erros.

As ações implementadas na API são:

| Ação              | Rota                                | Observação                                                                                            |
| ----------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Listar downloads  | `GET /downloads`                    | Somente downloads do usuário autenticado.                                                             |
| Detalhar download | `GET /downloads/{id}`               | Download de outro usuário retorna como não encontrado.                                                |
| Pausar            | `POST /downloads/{id}/pause`        | Idempotente quando já está pausado.                                                                   |
| Retomar           | `POST /downloads/{id}/resume`       | Usa `start` no qBittorrent 5.x.                                                                       |
| Cancelar          | `POST /downloads/{id}/cancel`       | Remove a tarefa do cliente e preserva os arquivos.                                                    |
| Excluir arquivos  | `POST /downloads/{id}/delete-files` | Exige `{"confirm": true}` e só funciona depois do cancelamento.                                       |
| Status do cliente | `GET /downloads/client-status`      | Indica se downloads estão habilitados e se o cliente respondeu.                                       |
| Eventos ao vivo   | `GET /downloads/events`             | SSE autenticado por `Authorization: Bearer`; o frontend deve consumir com `fetch`, não `EventSource`. |

Cancelar uma tarefa não apaga os arquivos. A exclusão é uma ação separada para reduzir risco de perda acidental.

### Persistência e recuperação

O PostgreSQL guarda histórico, status confirmado, progresso em checkpoints e relação com usuário/fonte. O Redis, quando configurado, guarda snapshots temporários e distribui eventos entre instâncias da API. Sem Redis, o projeto usa uma implementação em memória, adequada para uma instância local.

Na inicialização e a cada intervalo, o monitor reconcilia o banco com o qBittorrent: reenvia downloads pendentes, marca como erro o que sumiu do cliente e remove torrents órfãos com a tag do GameShelf preservando os arquivos.

### Exemplo reproduzível

Ainda não há arquivo de teste, magnet autorizado ou script `make-test-torrent` no repositório. Portanto, não há exemplo reproduzível de download para documentar sem inventar dados.

## Tecnologias utilizadas

| Tecnologia            | Função no projeto                                          | Status                                                                                            |
| --------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| React 19 + TypeScript | Interface web em `apps/web`.                               | Implementado e validado localmente nesta revisão.                                                 |
| Vite 8                | Desenvolvimento e build do frontend.                       | Implementado; build não foi executado nesta revisão.                                              |
| React Router 8        | Rotas do frontend.                                         | Implementado.                                                                                     |
| TanStack Query        | Cache e estados de dados no frontend.                      | Implementado.                                                                                     |
| Tailwind 4            | Estilização do frontend com tema escuro.                   | Implementado.                                                                                     |
| Node.js 24            | Runtime exigido por API e web.                             | Validado com Node 24.21.0 portátil nesta revisão.                                                 |
| NestJS 12 ESM         | API HTTP modular.                                          | Implementado e validado localmente nesta revisão.                                                 |
| PostgreSQL 18         | Banco relacional, constraints e triggers.                  | Implementado; e2e com banco real não validado nesta revisão.                                      |
| Prisma 7.10.0         | Schema, migrations e acesso ao banco.                      | Implementado com versao fixa.                                                                     |
| Vitest 4.1            | Testes unitarios e e2e.                                    | Unitarios da API e web passaram; e2e pendentes.                                                   |
| Docker Compose        | Ambiente básico com PostgreSQL, migration e API.           | Configuração parseada; containers não iniciados nesta revisão.                                    |
| Swagger/OpenAPI       | Documentação em `/docs`.                                   | Implementado na API.                                                                              |
| qBittorrent Web API   | Cliente torrent controlado pela API.                       | Implementado, depende de `QBT_URL`/credenciais e não foi validado com cliente real nesta revisão. |
| SSE                   | Eventos em tempo real de downloads em `/downloads/events`. | Implementado na API; frontend consumidor ainda não existe.                                        |
| Redis + ioredis       | Estado ao vivo e pub/sub de downloads entre instâncias.    | Opcional, depende de `REDIS_URL`; Compose ainda não inclui Redis.                                 |

### Tecnologias planejadas ou não integradas

| Tecnologia                                  | Status                                                                                         |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| BullMQ                                      | Planejado para etapa 3; não está nas dependências atuais.                                      |
| Elasticsearch                               | Planejado para busca avançada; não implementado.                                               |
| AWS Lambda e S3                             | Planejado; não implementado.                                                                   |
| Go                                          | Planejado para CLI futura; não implementado.                                                   |
| ClickHouse                                  | Planejado; não implementado.                                                                   |
| Sentry, OpenObserve, Prometheus e New Relic | Planejados para observabilidade; não implementados.                                            |
| Cloudflare Workers                          | Planejado; não implementado.                                                                   |
| GitHub Actions                              | Implementado em `.github/workflows/ci.yml` para API, web e validação do Compose básico.        |

## Arquitetura

```mermaid
flowchart LR
  Web[apps/web React] -->|HTTP + Bearer/cookie| API[apps/api NestJS]
  API --> Auth[Auth / Users]
  API --> Catalog[Catalog / Library / Reviews]
  API --> Downloads[Downloads]
  Auth --> DB[(PostgreSQL 18)]
  Catalog --> DB
  Downloads --> DB
  Downloads --> Live[LiveState memória ou Redis]
  Downloads -->|Web API v2| QBT[qBittorrent opcional]
  QBT --> Files[(volume de downloads no host/backend)]
  API -->|SSE text/event-stream| Web
```

Estrutura principal:

| Caminho                  | Conteúdo                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| `apps/api/src/auth`      | Cadastro, login, refresh, logout e guards.                                                      |
| `apps/api/src/catalog`   | Jogos, gêneros, plataformas e busca.                                                            |
| `apps/api/src/library`   | Biblioteca pessoal por usuário.                                                                 |
| `apps/api/src/reviews`   | Avaliações e integração com agregados do banco.                                                 |
| `apps/api/src/downloads` | Fontes de download, tarefas, SSE, monitor, qBittorrent, Redis/memória e segurança de diretório. |
| `apps/api/prisma`        | Schema, migrations e seed.                                                                      |
| `apps/web/src`           | Interface React, rotas, cliente HTTP, auth, paginas e componentes.                              |
| `docs`                   | Decisões técnicas e matriz de versões.                                                          |

## Como executar localmente

### Pré-requisitos

- Node.js 24 (`.nvmrc` contém `24`). Nesta revisão usei Node 24.21.0 portátil.
- npm compatível com Node 24.
- Docker Desktop para o Compose básico e para e2e com Testcontainers.
- PostgreSQL 18 se for executar a API sem Docker.

No Windows, se usar Node 24 portátil pelo Git Bash, coloque o caminho no `PATH` com formato `/c/...`; caminho `C:/...` pode quebrar no `:` e cair no Node global errado.

### Preparar ambiente

```bash
cp .env.example .env
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Copie o valor gerado para `JWT_ACCESS_SECRET` no `.env`. Não publique esse segredo.

### Ambiente básico com Docker Compose

```bash
docker compose up -d --build
docker compose run --rm migrate npm run db:seed
```

Serviços documentados no Compose atual:

| Serviço    | Porta no host    | Observação                                                           |
| ---------- | ---------------- | -------------------------------------------------------------------- |
| API        | `127.0.0.1:3000` | Swagger em `http://localhost:3000/docs`.                             |
| PostgreSQL | `127.0.0.1:5432` | Volume Docker `pgdata` em `/var/lib/postgresql` dentro do container. |

O Compose atual não tem perfil `torrent`. Para downloads reais via qBittorrent, ainda falta adicionar qBittorrent, Redis e um volume compartilhado de downloads montado também na API.

### API sem Docker

```bash
cd apps/api
npm ci
npx prisma migrate deploy
npm run db:seed
npm run start:dev
```

Use sempre o Prisma instalado no projeto (`npx prisma` dentro de `apps/api`), porque a versão está fixada em `7.10.0`.

### Frontend

```bash
cd apps/web
npm ci
npm run dev
```

Interface local: `http://localhost:5173`. Por padrao, o frontend chama `http://localhost:3000`. Para mudar, crie `apps/web/.env.local` com `VITE_API_URL=...`.

## Migrations, seed e testes

### Migrations

```bash
cd apps/api
npx prisma migrate deploy
```

As migrations incluem restrições manuais no PostgreSQL, como checks de autenticação, checks de catálogo, trigger de média de avaliações e checks do módulo de downloads.

### Seed

```bash
cd apps/api
npm run db:seed
```

O seed atual cria dados demonstrativos de catálogo, contas demo, biblioteca e avaliações. Ele não cadastra fonte torrent demonstrativa.

Contas demo documentadas no seed/README anterior:

| Email                 | Senha               |
| --------------------- | ------------------- |
| `demo@gameshelf.dev`  | `demo-password-123` |
| `demo2@gameshelf.dev` | `demo-password-123` |

### Testes e validações executadas nesta revisão

Com Node 24.21.0:

```bash
cd apps/api
npm run format:check
npm run lint
npm run typecheck
npm test
```

Resultado local: Prettier, ESLint, typecheck e 27 testes unitários passaram.

```bash
cd apps/web
npm run format:check
npm run lint
npm run typecheck
npm test
```

Resultado local: Prettier, ESLint, typecheck e 24 testes passaram.

```bash
JWT_ACCESS_SECRET=dummy-secret-with-at-least-32-characters docker compose config
```

Resultado local: a configuração Compose foi parseada com sucesso. Os containers não foram iniciados.

### Testes pendentes nesta revisão

```bash
cd apps/api
npm run test:e2e
```

Não foi validado: o Testcontainers não encontrou runtime Docker ativo, e não havia `TEST_DATABASE_URL` apontando para um PostgreSQL descartável. Sem Docker, use um banco de teste descartável:

```bash
TEST_DATABASE_URL="postgresql://usuario:senha@localhost:5432/gameshelf_test" npm run test:e2e
```

Atenção: os e2e apagam dados do banco informado.

## Documentação da API e exemplos de uso

Com a API rodando, acesse `http://localhost:3000/docs`.

Fluxo básico pelo Swagger:

1. `POST /auth/login` com `demo@gameshelf.dev` e `demo-password-123`.
2. Copie o `accessToken` e use em **Authorize** como Bearer.
3. Teste `GET /games`, `GET /games/{id}`, `GET /library` e rotas de avaliações.
4. Para downloads, consulte `GET /games/{gameId}/download-sources`; se houver fonte cadastrada e `QBT_URL` configurado, `POST /downloads` inicia a tarefa.

Principais rotas:

| Rota                                                                                                         | Acesso         | Função                                        |
| ------------------------------------------------------------------------------------------------------------ | -------------- | --------------------------------------------- |
| `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`                                        | Público/cookie | Sessão.                                       |
| `GET /users/me`, `PATCH /users/me`                                                                           | Bearer         | Perfil próprio.                               |
| `GET /games`, `GET /games/{id}`                                                                              | Público        | Catálogo e detalhes.                          |
| `GET /genres`, `GET /platforms`                                                                              | Público        | Filtros disponíveis.                          |
| `GET /library`, `POST /library`, `PATCH /library/{gameId}`, `DELETE /library/{gameId}`                       | Bearer         | Biblioteca pessoal.                           |
| `GET /games/{gameId}/reviews`, `POST /games/{gameId}/reviews`, `GET/PATCH/DELETE /games/{gameId}/reviews/me` | Público/Bearer | Avaliações.                                   |
| `GET /games/{gameId}/download-sources`                                                                       | Público        | Fontes ativas sem expor magnet ou `.torrent`. |
| `GET/POST /downloads`                                                                                        | Bearer         | Lista e inicia downloads.                     |
| `POST /downloads/{id}/pause`, `/resume`, `/cancel`, `/delete-files`                                          | Bearer         | Controle da tarefa.                           |
| `GET /downloads/events`                                                                                      | Bearer         | SSE autenticado para progresso em tempo real. |

## Decisões técnicas e limitações

As decisões D1 a D22 estão em [docs/decisoes.md](docs/decisoes.md). A matriz de versões está em [docs/versoes.md](docs/versoes.md).

Limitações relevantes no estado atual:

- A busca do catálogo usa PostgreSQL e olha apenas o nome; Elasticsearch ainda não existe.
- O rate limit ainda é em memória do processo.
- Não há papel de administrador nem rota pública para cadastrar fontes de download; os scripts CLI planejados ainda não existem.
- O módulo de downloads não instala nem executa jogos; ele apenas gerencia tarefas torrent e arquivos baixados.
- Sem `QBT_URL`, downloads ficam desativados por configuração e respondem 503 nas operações que dependem do cliente torrent.
- Sem `DOWNLOADS_DIR`, a exclusão de arquivos de downloads cancelados responde 503.
- O frontend ainda não exibe downloads.
- A documentação D23+ do módulo de downloads ainda não foi adicionada em `docs/decisoes.md`.

## Próximos passos

1. Criar testes unitários para bencode, metadata de torrent, mapeamento de estados, diretório de tarefa e cliente qBittorrent com `fetch` simulado.
2. Criar testes e2e de downloads com qBittorrent falso em `node:http` e PostgreSQL real.
3. Adicionar scripts CLI para cadastrar/desativar fontes e gerar torrent de teste autorizado.
4. Implementar frontend de downloads: página, botão no detalhe do jogo, item no menu e faixa de progresso no rodapé.
5. Adicionar perfil Docker `torrent` com qBittorrent, Redis e volume de downloads compartilhado com a API.
6. Atualizar `.env.example`, `docs/decisoes.md` e `docs/versoes.md` com as decisões e versões do módulo de downloads.
7. Seguir as etapas planejadas do projeto: Redis/BullMQ para sincronização, Elasticsearch, observabilidade, AWS, Go/CLI e ClickHouse.

## Sobre mim e contato

**Kaike Ferreira Alves**  
[LinkedIn](https://www.linkedin.com/in/kaikeferreiraalves/)
