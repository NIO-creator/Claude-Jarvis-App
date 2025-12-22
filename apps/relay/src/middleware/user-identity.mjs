/**
 * User Identity Middleware
 * Handles x-jarvis-user-id header for MVP user identification
 * @module middleware/user-identity
 */

import { randomUUID } from 'crypto';
import { ensureUser } from '../services/users.mjs';

const USER_ID_HEADER = 'x-jarvis-user-id';

/**
 * Register user identity middleware with Fastify
 * @param {import('fastify').FastifyInstance} app 
 */
export function registerUserIdentity(app) {
    // Add decorator for userId
    app.decorateRequest('userId', null);
    app.decorateRequest('userExternalId', null);

    // Pre-handler hook to process user identity
    app.addHook('preHandler', async (request, reply) => {
        // Skip for health endpoint
        if (request.url === '/health') {
            return;
        }

        // Get or generate external user ID
        let externalId = request.headers[USER_ID_HEADER];
        let isGenerated = false;

        if (!externalId) {
            externalId = randomUUID();
            isGenerated = true;
        }

        // Set response header (always, so client knows the user ID)
        reply.header(USER_ID_HEADER, externalId);

        try {
            // Ensure user exists in database
            const user = await ensureUser(externalId);

            // Attach to request for downstream handlers
            request.userId = user.id;
            request.userExternalId = externalId;

            if (isGenerated) {
                app.log.info({ externalId, userId: user.id }, 'Generated new user identity');
            }
        } catch (err) {
            app.log.error({ err }, 'Failed to ensure user identity');
            // Don't block request if database is down, but userId will be null
        }
    });
}
