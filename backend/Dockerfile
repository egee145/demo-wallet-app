FROM node:24.18.0-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@11.9.0 --activate
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/package.json
COPY mobile/package.json mobile/package.json
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
ARG DIRECT_URL=postgresql://postgres:postgres@localhost:5432/build_only
ENV DIRECT_URL=$DIRECT_URL
COPY backend backend
RUN pnpm --filter @hepantalya/backend prisma:generate \
  && pnpm --filter @hepantalya/backend build \
  && pnpm --filter @hepantalya/backend deploy --prod --legacy /prod/backend

FROM node:24.18.0-bookworm-slim AS runtime
ARG APP_VERSION=development
ENV NODE_ENV=production
LABEL org.opencontainers.image.title="HepAntalya Wallet API" \
  org.opencontainers.image.description="NestJS API for HepAntalya Wallet and NFC payments" \
  org.opencontainers.image.source="https://github.com/egee145/hepantalya-wallet" \
  org.opencontainers.image.version="${APP_VERSION}"
WORKDIR /app/backend
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /prod/backend/node_modules ./node_modules
COPY --from=build /prod/backend/package.json ./package.json
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/certs ./certs
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((response) => { if (!response.ok) process.exit(1) }).catch(() => process.exit(1))"
CMD ["node", "dist/main.js"]
