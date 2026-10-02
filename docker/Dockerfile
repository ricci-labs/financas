# syntax=docker/dockerfile:1

FROM node:24-alpine AS build
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN npm install --global pnpm@12.5.1
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts
COPY . .
RUN pnpm --filter @financas/api build
RUN pnpm --filter @financas/web build
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter @financas/api deploy --prod /out

FROM node:24-alpine AS runtime
ARG APP_VERSION=dev
ENV NODE_ENV=production \
    PORT=3100 \
    APP_VERSION=$APP_VERSION \
    FILE_STORAGE_DIR=/data/files \
    WEB_DIST_DIR=/app/web
WORKDIR /app
RUN mkdir -p /data/files && chown node:node /data/files
COPY --from=build --chown=node:node /out/package.json ./
COPY --from=build --chown=node:node /out/node_modules ./node_modules
COPY --from=build --chown=node:node /out/dist ./dist
COPY --from=build --chown=node:node /out/drizzle ./drizzle
COPY --from=build --chown=node:node /repo/apps/web/dist ./web
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
USER node
EXPOSE 3100 9464
VOLUME ["/data/files"]
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/api/health/live" || exit 1
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
