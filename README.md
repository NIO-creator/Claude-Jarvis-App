# JARVIS MVP

Real-time, voice-first AI hub with memory continuity.

## Structure

```
apps/
  relay/       # Node.js relay service (Fastify + WebSocket)
  web/         # Web frontend (placeholder)
packages/
  shared/      # Shared utilities and types
```

## Quick Start

```bash
pnpm install
pnpm dev
```

## Environment Variables

Copy `.env.sample` to `.env` and configure:

```bash
cp .env.sample .env
```

## Deployment

This project deploys to Google Cloud Run via GitHub Actions.
