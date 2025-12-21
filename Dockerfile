FROM node:20-slim AS builder

WORKDIR /app

# Copy package files for relay
COPY apps/relay/package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm install

# Copy source files
COPY apps/relay/tsconfig.json ./
COPY apps/relay/src ./src

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-slim AS runner

WORKDIR /app

# Copy built files and package.json
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Install production dependencies only
RUN npm install --omit=dev

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "dist/index.js"]
