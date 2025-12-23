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

## Local Development (Mock Mode)

Run the relay server without real LLM or TTS API keys using mock mode:

```bash
cd apps/relay

# Windows (PowerShell)
$env:LLM_MOCK_MODE="true"; $env:TTS_MOCK_MODE="true"; npm run dev

# Windows (cmd)
set LLM_MOCK_MODE=true && set TTS_MOCK_MODE=true && npm run dev

# Linux/Mac
LLM_MOCK_MODE=true TTS_MOCK_MODE=true npm run dev
```

Mock mode provides:
- **LLM Mock**: Deterministic JARVIS-style responses (no OpenAI/Gemini API key needed)
- **TTS Mock**: Skips actual TTS API calls

Check mock mode status via `/assistant/status` endpoint.

## Deployment

This project deploys to Google Cloud Run via GitHub Actions.
