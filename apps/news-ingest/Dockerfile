FROM node:20-alpine

WORKDIR /app

RUN corepack enable

COPY . .

RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @thesis/news-ingest build

EXPOSE 3004

CMD ["node", "apps/news-ingest/dist/src/server.js"]
