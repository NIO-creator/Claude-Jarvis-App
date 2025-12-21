FROM node:20-slim

WORKDIR /app

# Copy relay package files
COPY apps/relay/package.json ./
COPY apps/relay/tsconfig.json ./
COPY apps/relay/src ./src

# Install dependencies and build
RUN npm install
RUN npm run build

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "dist/index.js"]
