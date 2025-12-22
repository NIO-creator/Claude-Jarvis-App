/**
 * Memory Routes
 * @module routes/memory
 */

import { upsertFact, getAllFacts } from '../services/memory.mjs';

/**
 * Register memory routes
 * @param {import('fastify').FastifyInstance} app 
 */
export function registerMemoryRoutes(app) {
    /**
     * POST /memory/fact
     * Upsert a memory fact for the current user
     */
    app.post('/memory/fact', {
        schema: {
            body: {
                type: 'object',
                required: ['fact_key', 'fact_value'],
                properties: {
                    fact_key: { type: 'string', minLength: 1 },
                    fact_value: { type: 'string' },
                    confidence: { type: 'number', minimum: 0, maximum: 1, default: 1.0 }
                }
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        fact_key: { type: 'string' },
                        fact_value: { type: 'string' },
                        confidence: { type: 'number' }
                    }
                }
            }
        }
    }, async (request, reply) => {
        const userId = request.userId;
        if (!userId) {
            return reply.status(401).send({ error: 'User identity required' });
        }

        const { fact_key, fact_value, confidence = 1.0 } = request.body;

        try {
            const fact = await upsertFact(userId, fact_key, fact_value, confidence);

            return {
                id: fact.id,
                fact_key: fact.fact_key,
                fact_value: fact.fact_value,
                confidence: parseFloat(fact.confidence)
            };
        } catch (err) {
            app.log.error({ err }, 'Failed to upsert fact');
            return reply.status(500).send({ error: err.message || 'Failed to upsert fact' });
        }
    });

    /**
     * GET /memory/facts
     * Get all memory facts for the current user
     */
    app.get('/memory/facts', {
        schema: {
            response: {
                200: {
                    type: 'object',
                    properties: {
                        facts: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string' },
                                    fact_key: { type: 'string' },
                                    fact_value: { type: 'string' },
                                    confidence: { type: 'number' },
                                    created_at: { type: 'string' },
                                    updated_at: { type: 'string' }
                                }
                            }
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

        try {
            const facts = await getAllFacts(userId);

            return {
                facts: facts.map(f => ({
                    id: f.id,
                    fact_key: f.fact_key,
                    fact_value: f.fact_value,
                    confidence: parseFloat(f.confidence),
                    created_at: f.created_at,
                    updated_at: f.updated_at
                }))
            };
        } catch (err) {
            app.log.error({ err }, 'Failed to get facts');
            return reply.status(500).send({ error: 'Failed to get facts' });
        }
    });
}
