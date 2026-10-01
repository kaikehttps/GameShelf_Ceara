# Decisões técnicas

Registro curto das decisões e dos trade-offs, no formato "contexto → decisão → consequência".
Cada etapa acrescenta as suas.

## Etapa 1: estrutura, ambiente, banco e autenticação

### D1. Monólito modular em `apps/api`
- **Contexto:** um único time e um único domínio (jogos, usuários, avaliações). Microsserviços trariam rede, deploy e consistência distribuída sem benefício real.
- **Decisão:** uma API NestJS organizada por módulos (`auth`, `users`, depois `catalog`, `library`, `reviews`, `sync`). Processos auxiliares (Lambda, Worker, CLI em Go) ficam em pastas próprias só onde há motivo concreto.
- **Consequência:** um deploy, transações locais no PostgreSQL. Os módulos se comunicam por serviços injetados, não por HTTP.

### D2. NestJS 12 em ESM
- **Contexto:** os pacotes do Nest 12 são ESM-only. Uma aplicação CommonJS ainda funciona via `require(esm)`, mas fica fora do template oficial.
- **Decisão:** `"type": "module"`, `module: nodenext` e imports relativos com `.js`, como no template ESM oficial (que usa Vitest).
- **Consequência:** é preciso escrever `./arquivo.js` nos imports (o TypeScript resolve para o `.ts`). O `main.ts` usa `await` no topo do módulo.

### D3. Prisma 7 com driver adapter e versão fixada
- **Contexto:** o Prisma 7 não traz mais engine Rust no cliente (o query compiler é WASM) e exige um *driver adapter*. O `latest` do npm do CLI aponta para um RC do Prisma 8.
- **Decisão:** `prisma`, `@prisma/client` e `@prisma/adapter-pg` fixados em `7.10.0`. O gerador `prisma-client` escreve o cliente em `src/generated/prisma` (fora do git). A configuração do CLI fica em `prisma.config.ts`.
- **Consequência:** o cliente é compilado junto com a aplicação. `prisma generate` roda antes do build e dos testes. O CLI não lê `.env` sozinho, por isso o `dotenv` no config.

### D4. Restrições garantidas também no banco
- **Decisão:** além da validação na API, o banco tem `UNIQUE` (e-mail, hash do token) e `CHECK` escritos à mão na migration: e-mail em minúsculas, expiração ≤ expiração absoluta e "revogado ⇔ tem motivo".
- **Por quê:** a validação da API pode ser contornada (script, bug, outro serviço); o banco é a última linha de defesa. Os testes e2e gravam direto pelo Prisma para provar isso.

### D5. Access token curto + refresh token opaco e rotativo
- **Contexto:** um JWT não pode ser revogado antes de expirar; uma sessão só no servidor exige uma consulta ao banco em toda requisição.
- **Decisão:**
  - **Access token:** JWT HS256 de 15 minutos, com `iss` e `aud`, algoritmo fixado na verificação e enviado em `Authorization: Bearer`. O payload tem só `sub`.
  - **Refresh token:** 256 bits aleatórios, num cookie `HttpOnly; Secure; SameSite=Strict; Path=/auth`. O banco guarda **apenas o SHA-256**. Um hash rápido basta porque o token tem alta entropia, ao contrário de uma senha (NIST SP 800-63B-4).
  - **Rotação:** cada `/auth/refresh` revoga o token atual e emite outro na mesma *família* (= sessão). A troca é um *compare-and-set* (`UPDATE ... WHERE revoked_at IS NULL`) dentro de uma transação. Com requisições concorrentes, o PostgreSQL bloqueia a linha e só uma vence.
  - **Detecção de reutilização (RFC 9700 §4.14.2):** reapresentar um token já rotacionado revoga a família inteira.
  - **Janela de tolerância de 10 s:** dentro dela, a reapresentação é recusada sem derrubar a sessão. Evita deslogar quem tem duas abas renovando juntas (o Auth0 e o Okta fazem o mesmo).
  - **Duas expirações:** 7 dias de inatividade (renovada a cada rotação) e 30 dias absolutos desde o login.
- **Trade-offs:**
  - Após o logout, o access token continua válido por até 15 minutos. É o custo de não consultar o banco em toda requisição.
  - A janela de 10 s enfraquece um pouco a detecção. Mesmo nela, um token roubado nunca gera tokens novos.

### D6. Senhas com Argon2id (`@node-rs/argon2`)
- **Decisão:** Argon2id com o mínimo da OWASP (19 MiB, t=2, p=1). Usamos o `@node-rs/argon2` (binários pré-compilados) em vez do `argon2` (node-gyp, testado só a partir do Node 22).
- **Login:** a mensagem de erro é a mesma para e-mail inexistente e para senha errada. Quando o e-mail não existe, a senha é verificada contra um *hash fictício*, para o tempo de resposta não revelar se a conta existe.
- **Política de senha:** de 15 a 128 caracteres, sem regras de composição (NIST SP 800-63B-4 para contas sem MFA).

### D7. CSRF e cabeçalhos com os recursos nativos do Nest 12.1
- **Decisão:**
  - `app.enableCsrfProtection({ trustedOrigins })`: recusa métodos não seguros quando `Sec-Fetch-Site` indica outro site, com fallback `Origin` × `Host` (algoritmo do `CrossOriginProtection` do Go).
  - `app.useSecurityHeaders()`: os mesmos padrões do helmet 8.
  - `@Cookies()`: lê o cookie sem `cookie-parser`.
- **Por quê:** a proteção vale para todas as rotas e substitui três dependências.
- **Defesa em camadas:** o cookie é `SameSite=Strict` e as demais rotas usam o header `Authorization`, que o navegador não envia sozinho.

### D8. Rate limit por IP em memória (por enquanto)
- **Decisão:**
  - `@nestjs/throttler` global de 120 requisições/min por IP.
  - Nas rotas de autenticação: login 5/min, cadastro 5/min, refresh 30/min.
  - `TRUST_PROXY_HOPS` configura quantos proxies são confiáveis, para obter o IP real.
- **Limitações:**
  - O armazenamento fica na memória do processo: várias instâncias não compartilham o contador.
  - O limite é por IP, não por conta.
  - **Na etapa 3** (com Redis), o contador vai para o Redis e entra um limite de *falhas* de login por conta, como recomenda a OWASP.

### D9. Cadastro responde 409 para e-mail existente
- **Contexto:** a OWASP recomenda não revelar se um e-mail está cadastrado, mas sem confirmação por e-mail não há como esconder isso no cadastro.
- **Decisão:** responder `409`, com rate limit no cadastro. Documentado como trade-off consciente.

### D10. Migrations em um serviço one-off
- **Decisão:** o Compose tem um serviço `migrate`, construído a partir do estágio `migrate` do Dockerfile, que roda `prisma migrate deploy` e termina. A API só sobe depois que ele termina com sucesso (`service_completed_successfully`).
- **Por quê:** a imagem final da API fica sem o CLI do Prisma, sem devDependencies e sem openssl. E várias réplicas da API não disputam a aplicação das migrations.

### D11. Testes com banco real
- **Decisão:** os testes e2e sobem a aplicação inteira (mesmo `configureApp` do `main.ts`) contra um PostgreSQL real. Na CI, o Testcontainers cria um container descartável; sem Docker, `TEST_DATABASE_URL` aponta para um banco existente.
- **Por quê:** rotação concorrente, restrições `CHECK`/`UNIQUE` e transações não podem ser provadas com mocks.

## Etapa 2: catálogo, biblioteca pessoal e avaliações

### D12. Catálogo normalizado, com identificadores por provedor
- **Contexto:**
  - Cada provedor (Steam, Epic, LaunchBox) tem seus próprios IDs e nomes de gênero.
  - A sincronização (etapa 3) precisa reconhecer um jogo já importado.
  - Um mesmo nome pode ser jogos diferentes (remasters, homônimos).
- **Decisão:**
  - **`game_external_ids`:** tabela com `UNIQUE (provider, external_id)`, a chave da sincronização. Tem também `UNIQUE (game_id, provider)`: um jogo tem no máximo um ID por provedor. **Nunca** unimos jogos pelo nome.
  - **Gêneros e plataformas:** tabelas próprias com `slug` único (`CHECK` de formato), ligadas aos jogos por tabelas de junção.
- **Alternativa descartada:** colunas `text[]` em `games`. São mais simples, mas não dão um nome canônico ("RPG" × "Role-playing"), não alimentam `GET /genres` e deixam a normalização espalhada.
- **Consequência:** o filtro vira um `EXISTS` na tabela de junção. Por isso as junções têm índice também pela segunda coluna (`genre_id`, `platform_id`).

### D13. Busca no PostgreSQL: palavras no nome com ILIKE e trigramas
- **Decisão:**
  - `q` é quebrado em até 5 palavras, e cada uma precisa aparecer no nome (`ILIKE '%palavra%'`, combinadas com E).
  - Um índice GIN `gin_trgm_ops` (extensão `pg_trgm`) atende o ILIKE sem varrer a tabela.
  - O `contains` do Prisma **não escapa** `%` e `_`; buscar "%" retornaria tudo. Por isso escapamos os curingas antes da consulta. Há teste para isso, e ele falha se o escape for removido.
- **Alternativa descartada:** full-text search (`tsvector`). O Prisma não modela `tsvector`, então a listagem viraria SQL cru. Além disso, a busca por prefixo exige montar o `tsquery` à mão, e o ganho de relevância vem com o Elasticsearch (etapa 4).
- **Consequência:**
  - Sem ranking por relevância e sensível a acentos.
  - Na etapa 4, esta busca passa a ser a alternativa quando o Elasticsearch estiver indisponível. O PostgreSQL continua sendo a fonte de verdade.

### D14. Paginação por OFFSET com limites explícitos e ordem determinística
- **Decisão:**
  - **Limites:** `page` (1–1000) e `pageSize` (1–50, padrão 20). Valores fora do limite respondem 400, em vez de serem ajustados em silêncio.
  - **Ordem:** toda ordenação termina em `id`, para nenhum jogo aparecer em duas páginas ou sumir entre elas. Data e média deixam os nulos no fim nas duas direções (`NULLS LAST`).
  - **Resposta:** traz `total` e `totalPages`.
- **Alternativa descartada:** paginação por cursor (keyset). É mais estável e rápida em páginas profundas, mas complica a ordenação por vários critérios e a navegação por número de página no frontend.
- **Trade-off:** `OFFSET` fica mais lento quanto mais fundo; o limite de 1000 páginas contém o custo. A contagem (`COUNT`) roda a cada listagem, e o cache da etapa 3 vai absorver as consultas repetidas.

### D15. Média e quantidade de avaliações mantidas por trigger
- **Contexto:** a média aparece em toda listagem e serve para ordenar o catálogo, então precisa estar gravada no jogo. O desafio é mantê-la correta com escritas concorrentes.
- **Opções avaliadas:**
  - **Calcular `AVG` na leitura:** sempre correto, mas ordenar o catálogo por média exigiria agregar todas as avaliações a cada listagem.
  - **Recalcular no serviço (`SELECT AVG` + `UPDATE games`):** em READ COMMITTED, duas avaliações simultâneas leem antes uma da outra e uma atualização se perde. Só funciona bloqueando a linha do jogo (`SELECT ... FOR UPDATE`), que o Prisma não expressa.
  - **Incrementar no serviço:** a edição precisa da nota antiga, e duas edições simultâneas da mesma avaliação calculam a diferença errada.
- **Decisão:**
  - **Trigger:** `AFTER INSERT/UPDATE/DELETE` em `reviews` aplica a diferença em `games.rating_count`, `rating_sum` e `rating_average`, no mesmo comando e na mesma transação.
  - **Concorrência:** o `UPDATE` em `games` trava a linha do jogo e soma sobre o valor mais recente, então avaliações simultâneas não se perdem.
  - **Escritas fora da API:** vale também para SQL direto e para a exclusão em cascata de um usuário.
  - **Soma, não média:** guardamos a soma e não só a média, para não acumular erro de arredondamento. A média (`NUMERIC(3,2)`) é derivada da soma no mesmo `UPDATE`.
  - **CHECK de coerência:** quantidade ≥ 0; soma entre 1× e 5× a quantidade; média nula se e só se não houver avaliações.
- **Trade-offs:**
  - A regra fica no banco, menos visível que no código. Por isso a migration é comentada e os testes cobrem: criação, edição, exclusão, 20 avaliações simultâneas, cascata e SQL direto. Com a trigger removida, 9 testes falham.
  - Avaliações do mesmo jogo serializam por um instante na linha dele. É irrelevante nesta escala; com milhares de avaliações por segundo no mesmo jogo, o caminho seria agregar de forma assíncrona.
  - Mudar a média **não** altera `games.updated_at`, que fica reservado para mudanças nos dados do catálogo (sincronização e indexação).

### D16. Isolamento entre usuários por desenho das rotas
- **Decisão:**
  - A biblioteca usa `/library/{gameId}` e a avaliação própria usa `/games/{gameId}/reviews/me`.
  - O registro é sempre localizado pelo par (usuário do access token, jogo), nunca por um id de registro vindo do cliente.
  - Registro de outra pessoa simplesmente não é encontrado (404).
- **Por quê:** elimina a classe de falha IDOR (trocar o id na URL para acessar dados alheios) sem precisar de checagens de "dono" espalhadas.
- **Duplicação:** `UNIQUE (user_id, game_id)` em `library_entries` e em `reviews`. O serviço converte a violação (P2002) em 409. Isso vale para requisições simultâneas, testado com 5 POSTs em paralelo.

### D17. `null` em campos opcionais
- **Contexto:** `@IsOptional()` do class-validator pula a validação também quando o valor é `null`. Na etapa 1, `PATCH /users/me` com `{"displayName": null}` chegava ao Prisma numa coluna `NOT NULL` e respondia **500**. Encontrado ao escrever os DTOs da etapa 2 e reproduzido com teste antes da correção.
- **Decisão:** o decorator `IsOptionalNotNull()` só ignora campo **ausente**; `null` é validado e vira 400. Ele vale para nome de exibição, nota da avaliação e status da biblioteca. Onde `null` significa "remover" (bio, comentário), `@IsOptional()` continua.

### D18. Collation ICU nas colunas de nome
- **Contexto:** a ordem alfabética do PostgreSQL segue o locale com que o banco foi criado. Com `C` (o que a imagem Alpine usa na prática, já que a musl não implementa locales), a comparação é por bytes. Aí "Ação" fica depois de "Aventura", "Ábaco" depois de "Zelda" e "de Blob" depois de todos os nomes com maiúscula. O problema apareceu no smoke test com os gêneros do seed.
- **Decisão:** `games.name`, `genres.name` e `platforms.name` usam `COLLATE "und-x-icu"` (ordem Unicode padrão), escrito à mão na migration. O Prisma não expressa collation, e conferimos que ele não acusa diferença (*drift*).
- **Consequência:** a ordem fica a mesma em qualquer servidor, sem depender do locale. É preciso um PostgreSQL compilado com ICU: a imagem oficial é (`--with-icu`), e há um teste e2e de ordenação com acentos e minúsculas.

### D19. Seed demonstrativo indexado pelo App ID da Steam
- **Decisão:**
  - O seed cria 12 jogos com dados conferidos na loja da Steam, mais duas contas demo, uma biblioteca e 6 avaliações.
  - Ele procura cada jogo por `(STEAM, app_id)` e cria ou atualiza; nunca procura pelo nome.
  - É idempotente: rodado duas vezes, os números ficam iguais.
- **Por quê:** a demonstração ganha conteúdo antes da sincronização existir, e o seed já segue a mesma regra de identidade que a sincronização da etapa 3 vai usar.

## Frontend (`apps/web`)

### D20. React com Vite, TanStack Query e o estado na URL
- **Decisão:**
  - **Base:** Vite 8 + React 19 + TypeScript, estilizado com Tailwind 4. As cores do protótipo viram tokens (`bg-app-card`, `text-app-accent`...), sem cores soltas no código.
  - **Dados:** TanStack Query cuida do cache, dos estados de carregamento e de erro, e de atualizar o que mudou depois de uma ação (invalidação por chave).
  - **Estado na URL:** busca, filtros, ordem e página ficam na URL (`?busca=&genero=&ordem=&pagina=`), então dá para compartilhar ou recarregar sem perder o estado. A busca espera 300 ms de pausa na digitação antes de consultar.
- **Alternativa descartada:** `useEffect` + `fetch` à mão em cada tela. Seria mais código repetido para cache, cancelamento, *retry* e estados de erro.

### D21. Sessão no navegador: access token em memória, refresh pelo cookie
- **Decisão:**
  - O access token fica numa variável do módulo `api/client.ts`, nunca no `localStorage`.
  - Ao abrir a página, `POST /auth/refresh` (o cookie `HttpOnly` vai sozinho) restaura a sessão.
  - Um 401 numa chamada autenticada dispara **uma** renovação e repete o pedido.
- **Renovação, uma por vez:**
  - A API rotaciona o refresh token a cada uso (D5): duas renovações com o mesmo cookie fariam a segunda falhar e aquela aba sair da conta.
  - Na mesma aba, as chamadas compartilham uma única Promise.
  - Entre abas, a **Web Locks API** (`navigator.locks`) enfileira as renovações, e a segunda aba já envia o cookie novo.
- **Limitação conhecida:** se a página for fechada ou recarregada exatamente enquanto a resposta do refresh está chegando, a API já rotacionou o token, mas o navegador descarta o cookie novo. Dentro da janela de 10 s isso só encerra a sessão; depois dela, conta como reutilização e revoga a sessão. É o custo da rotação estrita. Num teste automatizado de recarga no meio da renovação, a sessão sobreviveu, mas o caso continua possível.

### D22. Fidelidade ao protótipo sem inventar dados
- **Decisão:** o layout do protótipo foi seguido (sidebar, cabeçalho com busca e `Ctrl+K`, banner, filtros em chips, grade de cards 3:4). Os elementos sem dado real foram trocados:
  - **Preço:** a nota média ocupa o lugar dele no card.
  - **"Mais jogados" e "Promoções":** viraram "Mais bem avaliados" e "Lançamentos".
  - **Filtro "Loja":** virou "Plataforma".
  - **Destaque:** é o jogo mais bem avaliado, não uma escolha editorial.
- **Mudança na API:**
  - **`bannerUrl`:** a capa passou a ser a arte vertical 3:4 da Steam, e entrou a coluna `bannerUrl` (arte larga), com o mesmo `CHECK` de https.
  - **`stores` e `storeUrl`:** as respostas ganharam `stores` (selo da loja) e `storeUrl` (link oficial, só quando o formato da URL é conhecido).
  - **`GET /library/status`:** marca "Na biblioteca" em uma página de cards com uma única requisição, em vez de uma por jogo.
