FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/relay/package.json ./apps/relay/

# Install dependencies
FROM base AS deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Build
FROM deps AS build
COPY apps/relay ./apps/relay
WORKDIR /app/apps/relay
RUN pnpm build

# Production
FROM node:20-slim AS runner
WORKDIR /app

COPY --from=build /app/apps/relay/dist ./dist
COPY --from=build /app/apps/relay/package.json ./

RUN npm install --omit=dev

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "dist/index.js"]
