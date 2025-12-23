# Stage 1: Build the Vite app
FROM node:20-slim AS builder

WORKDIR /app

# Accept build-time environment variables
ARG VITE_API_URL
ARG VITE_RELAY_URL
ARG COMMIT_SHA=dev

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_RELAY_URL=$VITE_RELAY_URL

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source files
COPY . .

# Build the production bundle
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Cloud Run requires port 8080
EXPOSE 8080

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
