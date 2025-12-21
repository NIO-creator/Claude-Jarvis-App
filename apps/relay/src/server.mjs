import Fastify from 'fastify';
import websocket from '@fastify/websocket';

const PORT = parseInt(process.env.PORT || '8080', 10);

const app = Fastify({
    logger: {
        level: process.env.LOG_LEVEL || 'info',
    },
});

// Register WebSocket
await app.register(websocket);

// Health endpoint
app.get('/health', async (request, reply) => {
    return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0-mvp',
    };
});

// WebSocket endpoint
app.get('/ws', { websocket: true }, (socket, request) => {
    app.log.info('WebSocket client connected');

    socket.on('message', (message) => {
        const data = message.toString();
        app.log.debug({ msg: 'WebSocket message received', data });
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
