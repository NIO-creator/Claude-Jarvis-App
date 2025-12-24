FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install --omit=dev

# Copy source files
COPY src ./src
COPY migrations ./migrations

# Build args for traceability
ARG COMMIT_SHA=unknown
ENV COMMIT_SHA=$COMMIT_SHA

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Use server.mjs directly (no TypeScript compilation needed)
CMD ["node", "src/server.mjs"]
