FROM node:20-alpine

WORKDIR /app

RUN corepack enable

COPY . .

RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @thesis/product-api build

EXPOSE 3001

CMD ["node", "apps/product-api/dist/src/server.js"]
