FROM node:20-alpine

WORKDIR /app

RUN corepack enable

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @thesis/scheduler build

EXPOSE 3005

CMD ["node", "apps/scheduler/dist/src/server.js"]
