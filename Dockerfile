# Multi-stage build: Nx production build + pruned app deps, then minimal runtime.
# Use: docker compose build api

FROM docker.io/node:22-bookworm AS builder

WORKDIR /app

ENV NX_DAEMON=false \
    CI=true

# Workspace manifest + Nx + TypeScript toolchain
COPY package.json package-lock.json nx.json tsconfig.base.json tsconfig.json ./

# App source and Nx project config
COPY apps/api ./apps/api

RUN npm ci

# Production bundle + pruned lockfile + workspace_modules (matches Nx docker:build deps)
RUN npx nx run @workspace/api:build:production --skip-nx-cache \
    && npx nx run @workspace/api:prune --skip-nx-cache


FROM docker.io/node:22-bookworm-slim AS runner

ENV HOST=0.0.0.0 \
    PORT=3000

WORKDIR /app

COPY --from=builder /app/apps/api/dist ./

RUN npm --omit=dev -f install

CMD ["node", "main.js"]
