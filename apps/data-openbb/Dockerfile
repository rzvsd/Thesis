FROM node:20-alpine

WORKDIR /app

RUN corepack enable

COPY . .

RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @thesis/data-openbb build

EXPOSE 3003

CMD ["node", "apps/data-openbb/dist/src/server.js"]
