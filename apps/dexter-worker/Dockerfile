FROM node:20-alpine

WORKDIR /app

RUN corepack enable

COPY . .

RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @thesis/dexter-worker build

EXPOSE 3002

CMD ["node", "apps/dexter-worker/dist/src/server.js"]
