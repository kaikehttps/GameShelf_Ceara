# syntax=docker/dockerfile:1

# Debian slim (e não Alpine): o schema engine do Prisma 7, usado nas migrations,
# teve problemas conhecidos com musl. Versão fixa para builds reproduzíveis.
ARG NODE_IMAGE=node:24.21.0-bookworm-slim

# ---- deps: todas as dependências (inclusive as de desenvolvimento, para o build)
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
# openssl: exigido pelo schema engine do Prisma (`prisma migrate`).
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---- build: gera o cliente Prisma e compila o TypeScript
FROM deps AS build
COPY . .
RUN npm run build

# ---- migrate: usada pelo serviço one-off `migrate` do Compose (tem o CLI do Prisma)
FROM build AS migrate
CMD ["npm", "run", "prisma:deploy"]

# ---- runtime: só o necessário para rodar a API (sem CLI do Prisma nem devDependencies)
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
# A imagem slim não tem curl; o fetch nativo do Node faz o papel.
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health/live').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
CMD ["node", "dist/main.js"]
