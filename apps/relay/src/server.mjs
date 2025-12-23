import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { checkDatabase } from './db-client.mjs';
import { registerUserIdentity } from './middleware/user-identity.mjs';
import { registerSessionRoutes } from './routes/session.mjs';
import { registerMemoryRoutes } from './routes/memory.mjs';
import { registerAssistantRoutes } from './routes/assistant.mjs';
import { registerVoiceWebSocket } from './ws/handler.mjs';
import { getProviderStatus } from './tts/index.mjs';
import { initPersonaRegistry } from './personas/registry.mjs';
import { getStatus as getLLMStatus } from './llm/openai-client.mjs';

const PORT = parseInt(process.env.PORT || '8080', 10);

const app = Fastify({
    logger: {
        level: process.env.LOG_LEVEL || 'info',
    },
});

// Register WebSocket
await app.register(websocket);

// Register user identity middleware (must come before routes)
registerUserIdentity(app);

// Health endpoint with TTS and LLM status
app.get('/health', async (request, reply) => {
    const dbHealthy = await checkDatabase();
    const ttsStatus = await getProviderStatus();
    const llmStatus = getLLMStatus();

    return {
        status: dbHealthy ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        version: '1.2.0-persona',
        commit_sha: process.env.COMMIT_SHA || 'dev',
        checks: {
            database: dbHealthy,
            tts: {
                primary: ttsStatus.activeFallback,
                providers: ttsStatus
            },
            llm: llmStatus
        }
    };
});

// Register session routes
registerSessionRoutes(app);

// Register memory routes
registerMemoryRoutes(app);

// Register assistant routes (LLM response generation)
registerAssistantRoutes(app);

// Register voice WebSocket handler (replaces old minimal handler)
registerVoiceWebSocket(app);

// Start server
try {
    // Initialize persona registry before listening
    await initPersonaRegistry();

    await app.listen({ port: PORT, host: '0.0.0.0' });
    app.log.info(`JARVIS Relay MVP listening on port ${PORT}`);
    app.log.info(`TTS Provider: ${process.env.TTS_PROVIDER || 'cartesia (default)'}`);
    app.log.info(`LLM Model: ${process.env.LLM_MODEL || 'gpt-4o'}`);
    app.log.info(`Mock Mode: ${process.env.TTS_MOCK_MODE === 'true' ? 'ENABLED' : 'disabled'}`);
} catch (err) {
    app.log.error(err);
    process.exit(1);
}

