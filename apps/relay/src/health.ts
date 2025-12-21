import type { FastifyInstance } from 'fastify';
import { checkDatabase } from './db.js';

interface HealthResponse {
    status: 'ok' | 'degraded';
    timestamp: string;
    version: string;
    checks: {
        database: boolean;
    };
}

export function registerHealth(app: FastifyInstance) {
    app.get('/health', async (_request, reply) => {
        const dbHealthy = await checkDatabase();

        const response: HealthResponse = {
            status: dbHealthy ? 'ok' : 'degraded',
            timestamp: new Date().toISOString(),
            version: '1.0.0-mvp',
            checks: {
                database: dbHealthy,
            },
        };

        const statusCode = dbHealthy ? 200 : 503;
        return reply.status(statusCode).send(response);
    });
}
