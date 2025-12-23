import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import multipart from '@fastify/multipart';
import { checkDatabase } from './db-client.mjs';
import { registerUserIdentity } from './middleware/user-identity.mjs';
import { registerSessionRoutes } from './routes/session.mjs';
import { registerMemoryRoutes } from './routes/memory.mjs';
import { registerAssistantRoutes } from './routes/assistant.mjs';
import { registerSTTRoutes, isSTTConfigured } from './routes/stt.mjs';
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

// Register CORS
await app.register(cors, {
    origin: [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'https://jarvis-web-mvp-987409605790.europe-west1.run.app'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-jarvis-user-id'],
});

// Register WebSocket
await app.register(websocket);

// Register multipart for file uploads (STT audio)
await app.register(multipart, {
    limits: {
        fileSize: 25 * 1024 * 1024, // 25MB max (Whisper limit)
    }
});

// Register user identity middleware (must come before routes)
registerUserIdentity(app);

// Health endpoint with TTS, LLM, and STT status
app.get('/health', async (request, reply) => {
    const dbHealthy = await checkDatabase();
    const ttsStatus = await getProviderStatus();
    const llmStatus = getLLMStatus();

    return {
        status: dbHealthy ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        version: '1.3.0-voicetov',
        commit_sha: process.env.COMMIT_SHA || 'dev',
        checks: {
            database: dbHealthy,
            tts: {
                primary: ttsStatus.activeFallback,
                providers: ttsStatus
            },
            llm: llmStatus,
            stt: {
                configured: isSTTConfigured(),
                mock_mode: process.env.STT_MOCK_MODE === 'true'
            }
        }
    };
});

// Register session routes
registerSessionRoutes(app);

// Register memory routes
registerMemoryRoutes(app);

// Register assistant routes (LLM response generation)
registerAssistantRoutes(app);

// Register STT routes (speech-to-text)
registerSTTRoutes(app);

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
    app.log.info(`STT: ${isSTTConfigured() ? 'configured' : 'NOT configured'} (mock=${process.env.STT_MOCK_MODE === 'true'})`);
    app.log.info(`Mock Modes: TTS=${process.env.TTS_MOCK_MODE === 'true'}, LLM=${process.env.LLM_MOCK_MODE === 'true'}, STT=${process.env.STT_MOCK_MODE === 'true'}`);

} catch (err) {
    app.log.error(err);
    process.exit(1);
}


