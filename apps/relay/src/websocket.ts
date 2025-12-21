import type { FastifyInstance } from 'fastify';

export function registerWebSocket(app: FastifyInstance) {
    app.get('/ws', { websocket: true }, (socket, _request) => {
        app.log.info('WebSocket client connected');

        socket.on('message', (message: Buffer) => {
            const data = message.toString();
            app.log.debug({ msg: 'WebSocket message received', data });

            // Echo back for now - to be replaced with actual relay logic
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
}
