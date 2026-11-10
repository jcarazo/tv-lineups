# syntax=docker/dockerfile:1
FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_URL=/data/app.db \
    EXPORT_DIR=/export
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# Migrations run on startup from lib/db/migrations.
COPY --from=build /app/lib/db/migrations ./lib/db/migrations
# Native SQLite binding is loaded from prebuilds at runtime; make sure it is present.
COPY --from=build /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
EXPOSE 3000
CMD ["node", "server.js"]
