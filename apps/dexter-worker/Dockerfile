FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache bash curl git unzip

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV BUN_INSTALL=/root/.bun
ENV PATH="${BUN_INSTALL}/bin:${PATH}"

RUN curl -fsSL https://bun.sh/install | bash
RUN corepack enable

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @thesis/dexter-worker build

EXPOSE 3002

CMD ["node", "apps/dexter-worker/dist/apps/dexter-worker/src/server.js"]
