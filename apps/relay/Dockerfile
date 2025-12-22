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
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile || npm install

# Runtime stage
FROM node:20-slim AS runner
WORKDIR /app/apps/relay

# Copy all source files (mjs files, no compilation needed)
COPY apps/relay/package.json ./
COPY apps/relay/src ./src
COPY apps/relay/migrations ./migrations

# Install production dependencies
RUN npm install --omit=dev

# Build args for traceability
ARG COMMIT_SHA=unknown
ENV COMMIT_SHA=$COMMIT_SHA

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Use server.mjs directly (no TypeScript compilation needed)
CMD ["node", "src/server.mjs"]
