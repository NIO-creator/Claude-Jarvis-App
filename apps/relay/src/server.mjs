import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { checkDatabase } from './db-client.mjs';
import { registerUserIdentity } from './middleware/user-identity.mjs';
import { registerSessionRoutes } from './routes/session.mjs';
import { registerMemoryRoutes } from './routes/memory.mjs';

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

// Health endpoint
app.get('/health', async (request, reply) => {
    const dbHealthy = await checkDatabase();
    return {
        status: dbHealthy ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        version: '1.0.0-mvp',
        checks: {
            database: dbHealthy
        }
    };
});

// Register session routes
registerSessionRoutes(app);

// Register memory routes
registerMemoryRoutes(app);

// WebSocket endpoint (minimal, kept alive for future voice pipe)
app.get('/ws', { websocket: true }, (socket, request) => {
    app.log.info('WebSocket client connected');

    socket.on('message', (message) => {
        const data = message.toString();
        app.log.debug({ msg: 'WebSocket message received', data });

        // Parse and handle protocol messages
        try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'identify') {
                // Associate user/session with WebSocket (future use)
                socket.send(JSON.stringify({
                    type: 'identified',
                    user_id: parsed.user_id,
                    session_id: parsed.session_id,
                    timestamp: new Date().toISOString()
                }));
                return;
            }
        } catch (e) {
            // Not JSON, handle as raw message
        }

        socket.send(JSON.stringify({
            type: 'ack',
            timestamp: new Date().toISOString()
        }));
    });

    socket.on('close', () => {
        app.log.info('WebSocket client disconnected');
    });

    socket.on('error', (err) => {
        app.log.error({ err }, 'WebSocket error');
    });

    // Send initial connection confirmation
    socket.send(JSON.stringify({
        type: 'connected',
        version: '1.0.0-mvp',
        timestamp: new Date().toISOString()
    }));
});

// Start server
try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    app.log.info(`JARVIS Relay MVP listening on port ${PORT}`);
} catch (err) {
    app.log.error(err);
    process.exit(1);
}
