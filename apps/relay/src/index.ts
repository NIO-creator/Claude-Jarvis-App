import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { registerHealth } from './health.js';
import { registerWebSocket } from './websocket.js';
import { logger } from './logger.js';

const PORT = parseInt(process.env.PORT || '8080', 10);

async function main() {
    const app = Fastify({
        logger: logger,
    });

    // Register plugins
    await app.register(websocket);

    // Register routes
    registerHealth(app);
    registerWebSocket(app);

    // Start server
    try {
        await app.listen({ port: PORT, host: '0.0.0.0' });
        app.log.info(`JARVIS Relay MVP listening on port ${PORT}`);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}

main();
