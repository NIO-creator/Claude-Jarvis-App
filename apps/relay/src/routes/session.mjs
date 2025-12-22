/**
 * Session Routes
 * @module routes/session
 */

import { createSession, endSession, getSessionById, getActiveSession } from '../services/sessions.mjs';
import { appendMessage } from '../services/messages.mjs';
import { buildBootstrapContext } from '../services/bootstrap.mjs';

/**
 * Register session routes
 * @param {import('fastify').FastifyInstance} app 
 */
export function registerSessionRoutes(app) {
    /**
     * POST /session/start
     * Creates a new session and returns bootstrap context
     */
    app.post('/session/start', {
        schema: {
            body: {
                type: 'object',
                properties: {
                    persona_id: { type: 'string', default: 'jarvis' },
                    kb_pack_id: { type: 'string', default: 'none' }
                }
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        session_id: { type: 'string' },
                        started_at: { type: 'string' },
                        bootstrap_context: {
                            type: 'object',
                            additionalProperties: true
                        }
                    }
                }
            }
        }
    }, async (request, reply) => {
        const userId = request.userId;
        if (!userId) {
            return reply.status(401).send({ error: 'User identity required' });
        }

        const { persona_id = 'jarvis', kb_pack_id = 'none' } = request.body || {};

        try {
            // Create new session
            const session = await createSession(userId);

            // Build bootstrap context
            const bootstrapContext = await buildBootstrapContext({
                userId,
                personaId: persona_id,
                kbPackId: kb_pack_id
            });

            return {
                session_id: session.id,
                started_at: session.started_at,
                bootstrap_context: bootstrapContext
            };
        } catch (err) {
            app.log.error({ err }, 'Failed to start session');
            return reply.status(500).send({ error: 'Failed to start session' });
        }
    });

    /**
     * POST /session/end
     * Ends the current session
     */
    app.post('/session/end', {
        schema: {
            body: {
                type: 'object',
                required: ['session_id'],
                properties: {
                    session_id: { type: 'string' }
                }
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        session_id: { type: 'string' },
                        ended_at: { type: 'string' }
                    }
                }
            }
        }
    }, async (request, reply) => {
        const userId = request.userId;
        if (!userId) {
            return reply.status(401).send({ error: 'User identity required' });
        }

        const { session_id } = request.body;

        try {
            // Verify session belongs to user
            const session = await getSessionById(session_id);
            if (!session) {
                return reply.status(404).send({ error: 'Session not found' });
            }
            if (session.user_id !== userId) {
                return reply.status(403).send({ error: 'Session does not belong to user' });
            }

            // End the session
            const ended = await endSession(session_id);

            return {
                session_id: ended.id,
                ended_at: ended.ended_at
            };
        } catch (err) {
            app.log.error({ err }, 'Failed to end session');
            return reply.status(500).send({ error: 'Failed to end session' });
        }
    });

    /**
     * POST /session/:sessionId/message
     * Appends a message to a session
     */
    app.post('/session/:sessionId/message', {
        schema: {
            params: {
                type: 'object',
                required: ['sessionId'],
                properties: {
                    sessionId: { type: 'string' }
                }
            },
            body: {
                type: 'object',
                required: ['role', 'content'],
                properties: {
                    role: { type: 'string', enum: ['user', 'assistant', 'system'] },
                    content: { type: 'string' },
                    metadata: { type: 'object' }
                }
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        message_id: { type: 'string' },
                        created_at: { type: 'string' }
                    }
                }
            }
        }
    }, async (request, reply) => {
        const userId = request.userId;
        if (!userId) {
            return reply.status(401).send({ error: 'User identity required' });
        }

        const { sessionId } = request.params;
        const { role, content, metadata } = request.body;

        try {
            // Verify session belongs to user
            const session = await getSessionById(sessionId);
            if (!session) {
                return reply.status(404).send({ error: 'Session not found' });
            }
            if (session.user_id !== userId) {
                return reply.status(403).send({ error: 'Session does not belong to user' });
            }
            if (session.ended_at) {
                return reply.status(400).send({ error: 'Cannot append to ended session' });
            }

            // Append message (transaction-wrapped for commit guarantee)
            const message = await appendMessage(sessionId, role, content, metadata);

            return {
                message_id: message.id,
                created_at: message.created_at
            };
        } catch (err) {
            app.log.error({ err }, 'Failed to append message');
            return reply.status(500).send({ error: err.message || 'Failed to append message' });
        }
    });
}
