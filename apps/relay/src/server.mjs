import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { checkDatabase } from './db-client.mjs';
import { registerUserIdentity } from './middleware/user-identity.mjs';
import { registerSessionRoutes } from './routes/session.mjs';
import { registerMemoryRoutes } from './routes/memory.mjs';
import { registerVoiceWebSocket } from './ws/handler.mjs';
import { getProviderStatus } from './tts/index.mjs';

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

// Health endpoint with TTS status
app.get('/health', async (request, reply) => {
    const dbHealthy = await checkDatabase();
    const ttsStatus = await getProviderStatus();

    return {
        status: dbHealthy ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        version: '1.1.0-voice',
        commit_sha: process.env.COMMIT_SHA || 'dev',
        checks: {
            database: dbHealthy,
            tts: {
                primary: ttsStatus.activeFallback,
                providers: ttsStatus
            }
        }
    };
});

// Register session routes
registerSessionRoutes(app);

// Register memory routes
registerMemoryRoutes(app);

// Register voice WebSocket handler (replaces old minimal handler)
registerVoiceWebSocket(app);

// Start server
try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    app.log.info(`JARVIS Relay MVP listening on port ${PORT}`);
    app.log.info(`TTS Provider: ${process.env.TTS_PROVIDER || 'cartesia (default)'}`);
    app.log.info(`Mock Mode: ${process.env.TTS_MOCK_MODE === 'true' ? 'ENABLED' : 'disabled'}`);
} catch (err) {
    app.log.error(err);
    process.exit(1);
}

