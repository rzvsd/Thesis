FROM node:20-alpine

WORKDIR /app

RUN corepack enable

COPY . .

RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @thesis/mobile build

EXPOSE 3006

CMD ["node", "apps/mobile/dist/src/server.js"]
