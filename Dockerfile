# syntax=docker/dockerfile:1.4
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
# Necessário para alguns binários nativos no alpine
RUN apk update && apk add --no-cache libc6-compat
WORKDIR /app
# Copia o código fonte
COPY . .
# Instala as dependências e constrói tudo (API, Worker, Web)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm build
# Após o build da web, copia os arquivos estáticos para standalone
# (O Next.js output: standalone cria um server.js próprio que precisa do public e static)
RUN cp -r apps/web/public apps/web/.next/standalone/apps/web/public || true
RUN cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static || true

# -----------------
# 1. API RUNNER
# -----------------
FROM node:20-alpine AS api
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
# Root package.json e Prisma schema (necessários para prisma db push)
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/prisma ./prisma
COPY start-api.sh ./
RUN chmod +x ./start-api.sh
# Expõe porta interna
EXPOSE 3001
ENV NODE_ENV=production
CMD ["./start-api.sh"]

# -----------------
# 2. WORKER RUNNER
# -----------------
FROM node:20-alpine AS worker
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder /app/apps/worker/package.json ./apps/worker/package.json
# Bibliotecas internas
COPY --from=builder /app/packages ./packages
ENV NODE_ENV=production
CMD ["node", "apps/worker/dist/main.js"]

# -----------------
# 3. WEB RUNNER
# -----------------
FROM node:20-alpine AS web
WORKDIR /app
ENV NODE_ENV=production
# Next.js standalone folder contem o node_modules otimizado necessário para a web
COPY --from=builder /app/apps/web/.next/standalone ./
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
