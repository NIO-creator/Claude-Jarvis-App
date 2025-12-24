/**
 * Assistant Routes - LLM response generation with fallback
 * @module routes/assistant
 */

import { getSessionById } from '../services/sessions.mjs';
import { appendMessage } from '../services/messages.mjs';
import { buildBootstrapContext } from '../services/bootstrap.mjs';
import { buildLLMContext, validateContext } from '../llm/context-builder.mjs';
import { generateWithFallback, getProviderStatus, isConfigured } from '../llm/index.mjs';

/**
 * Register assistant routes
 * @param {import('fastify').FastifyInstance} app 
 */
export function registerAssistantRoutes(app) {
    /**
     * POST /assistant/respond
     * Generate an LLM response with fallback and store it
     * 
     * Flow:
     * 1. Validate session ownership
     * 2. Load persona from registry (JARVIS enforced at SYSTEM level)
     * 3. Load memory facts
     * 4. Load last session transcript
     * 5. Build LLM context
     * 6. Call LLM with fallback (OpenAI → Gemini)
     * 7. Store user message in messages table
     * 8. Store assistant response in messages table
     * 9. Return response text with provider info
     */
    app.post('/assistant/respond', {
        schema: {
            body: {
                type: 'object',
                required: ['session_id', 'user_text'],
                properties: {
                    session_id: { type: 'string', format: 'uuid' },
                    user_text: { type: 'string', minLength: 1 },
                    persona_id: { type: 'string', default: 'jarvis' }
                }
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        response_text: { type: 'string' },
                        message_id: { type: 'string' },
                        user_message_id: { type: 'string' },
                        provider: { type: 'string' },
                        fallback_used: { type: 'boolean' },
                        correlation_id: { type: 'string' }
                    }
                }
            }
        }
    }, async (request, reply) => {
        const userId = request.userId;
        if (!userId) {
            return reply.status(401).send({ error: 'User identity required' });
        }

        // Check LLM configuration
        if (!await isConfigured()) {
            return reply.status(503).send({
                error: 'LLM not configured. Set OPENAI_API_KEY or GEMINI_API_KEY.'
            });
        }

        const { session_id, user_text, persona_id = 'jarvis' } = request.body;

        // Test header: x-jarvis-test-llm allows forcing a specific provider (openai|gemini)
        const forceProvider = request.headers['x-jarvis-test-llm'];
        if (forceProvider) {
            app.log.info({ forceProvider }, 'LLM provider override requested via header');
        }

        try {
            // Step 1: Validate session ownership
            const session = await getSessionById(session_id);
            if (!session) {
                return reply.status(404).send({ error: 'Session not found' });
            }
            if (session.user_id !== userId) {
                return reply.status(403).send({ error: 'Session does not belong to user' });
            }
            if (session.ended_at) {
                return reply.status(400).send({ error: 'Cannot respond to ended session' });
            }

            // Steps 2-4: Load persona, memory, and last session transcript
            // Persona is ALWAYS jarvis (enforced at SYSTEM level)
            const bootstrapContext = await buildBootstrapContext({
                userId,
                personaId: 'jarvis', // Enforced - frontend cannot override
                kbPackId: 'none'
            });

            // Step 5: Build LLM context with deterministic ordering
            const llmContext = buildLLMContext({
                persona_prompt: bootstrapContext.persona_prompt,
                memory_facts: bootstrapContext.memory_facts,
                last_session_transcript: bootstrapContext.last_session_transcript,
                user_input: user_text
            });

            // Validate context structure
            validateContext(llmContext);

            app.log.info({
                session_id,
                persona_id: 'jarvis',
                memory_fact_count: bootstrapContext.memory_facts.length,
                transcript_length: bootstrapContext.last_session_transcript?.length || 0,
                message_count: llmContext.messages.length
            }, 'Calling LLM with fallback');

            // Step 6: Call LLM with automatic fallback (OpenAI → Gemini)
            // If x-jarvis-test-llm header is set, force that provider for testing
            const llmResponse = await generateWithFallback(
                { messages: llmContext.messages },
                { forceProvider: forceProvider || undefined }
            );
            const responseText = llmResponse.content;

            // Step 7: Store user message (first, for proper ordering)
            const userMessage = await appendMessage(session_id, 'user', user_text);

            // Step 8: Store assistant response
            const assistantMessage = await appendMessage(session_id, 'assistant', responseText);

            app.log.info({
                session_id,
                user_message_id: userMessage.id,
                assistant_message_id: assistantMessage.id,
                response_length: responseText.length,
                provider: llmResponse.provider,
                fallback_used: llmResponse.fallback_used,
                correlation_id: llmResponse.correlation_id
            }, 'LLM response stored');

            // Step 9: Return response with provider info
            // Set correlation_id header for easy access
            reply.header('x-correlation-id', llmResponse.correlation_id);
            return {
                response_text: responseText,
                message_id: assistantMessage.id,
                user_message_id: userMessage.id,
                provider: llmResponse.provider,
                fallback_used: llmResponse.fallback_used,
                correlation_id: llmResponse.correlation_id
            };
        } catch (err) {
            app.log.error({
                err,
                session_id,
                correlation_id: err.correlation_id,
                provider_errors: err.provider_errors
            }, 'Failed to generate response');

            // All providers failed
            if (err.provider_errors) {
                return reply.status(502).send({
                    error: 'All LLM providers failed',
                    correlation_id: err.correlation_id
                });
            }

            // Single provider error
            if (err.message?.includes('OpenAI') || err.message?.includes('Gemini')) {
                return reply.status(502).send({ error: 'LLM service error' });
            }

            return reply.status(500).send({ error: err.message || 'Failed to generate response' });
        }
    });

    /**
     * GET /assistant/status
     * Check LLM service status with fallback info
     */
    app.get('/assistant/status', async (request, reply) => {
        const status = await getProviderStatus();
        return status;
    });
}
