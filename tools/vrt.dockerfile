ARG NODE_VERSION=24.11.1
FROM node:${NODE_VERSION}-bookworm-slim

ENV CI=1 \
    VRT=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    STORYBOOK_DISABLE_TELEMETRY=1

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc .pnpmfile.cjs ./
COPY eslint-plugin ./eslint-plugin

RUN npm install --global "$(node --print 'require("./package.json").packageManager')" \
    && pnpm install --frozen-lockfile --ignore-scripts \
    && pnpm rebuild esbuild \
    && pnpm exec install-electron \
    && pnpm exec playwright install --with-deps chromium \
    && chmod -R a+rwX node_modules \
    && rm -rf /var/lib/apt/lists/*
