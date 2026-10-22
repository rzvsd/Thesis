FROM node:24-alpine

WORKDIR /app

RUN corepack enable

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @thesis/product-api build
RUN mkdir -p /app/data/artifacts && chown -R node:node /app

USER node

EXPOSE 3001

CMD ["node", "apps/product-api/dist/apps/product-api/src/server.js"]
