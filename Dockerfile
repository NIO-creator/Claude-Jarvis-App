FROM node:20-slim

WORKDIR /app

# Copy package files
COPY apps/relay/package*.json ./

# Install production dependencies only
RUN npm install --omit=dev

# Copy all source files
COPY apps/relay/src/ ./src/
COPY apps/relay/migrations/ ./migrations/

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "src/server.mjs"]
