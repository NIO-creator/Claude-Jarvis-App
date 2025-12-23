/**
 * LLM Provider Factory
 * Manages provider selection, fallback, and response orchestration
 * @module llm/index
 * 
 * FALLBACK ORDER (MANDATORY):
 * 1. OpenAI (primary)
 * 2. Gemini (fallback)
 */

import { OpenAIProvider } from './providers/openai.mjs';
import { GeminiProvider } from './providers/gemini.mjs';
import { randomUUID } from 'crypto';

/**
 * Provider instances (singletons)
 */
const providers = {
    openai: new OpenAIProvider(),
    gemini: new GeminiProvider()
};

/**
 * Explicit fallback order - this defines the priority chain
 * OpenAI first, Gemini second (as mandated)
 */
const LLM_FALLBACK_ORDER = ['openai', 'gemini'];

/**
 * Error codes that trigger fallback
 * 401 = Unauthorized, 429 = Rate limit, 5xx = Server errors
 */
const FALLBACK_ERROR_CODES = [401, 403, 429, 500, 502, 503, 504];

/**
 * Check if error should trigger fallback
 * @param {Error} error
 * @returns {boolean}
 */
function shouldFallback(error) {
    // Network errors
    if (error.message?.includes('fetch') || error.message?.includes('network')) {
        return true;
    }

    // HTTP error codes that warrant fallback
    if (error.status && FALLBACK_ERROR_CODES.includes(error.status)) {
        return true;
    }

    // API configuration errors
    if (error.message?.includes('not configured')) {
        return true;
    }

    return false;
}

/**
 * Generate LLM response with automatic fallback
 * @param {import('./providers/types.mjs').LLMRequest} request
 * @returns {Promise<import('./providers/types.mjs').LLMResponse & { fallback_used: boolean }>}
 * @throws {Error} If all providers fail
 */
export async function generateWithFallback(request) {
    const correlationId = randomUUID();
    const errors = [];
    let fallbackUsed = false;

    for (const providerName of LLM_FALLBACK_ORDER) {
        const provider = providers[providerName];

        if (!await provider.isAvailable()) {
            console.log(`[LLM:${correlationId}] Provider '${providerName}' not available, skipping`);
            continue;
        }

        try {
            console.log(`[LLM:${correlationId}] Attempting provider: ${providerName}`);
            const response = await provider.generate(request);

            if (fallbackUsed) {
                console.log(`[LLM:${correlationId}] Fallback to '${providerName}' succeeded`);
            }

            return {
                ...response,
                fallback_used: fallbackUsed,
                correlation_id: correlationId
            };
        } catch (error) {
            // Log error without exposing secrets
            console.error(`[LLM:${correlationId}] Provider '${providerName}' failed:`, {
                message: error.message,
                status: error.status,
                // Do NOT log error.body as it may contain secrets in the request
            });

            errors.push({
                provider: providerName,
                error: error.message,
                status: error.status
            });

            if (shouldFallback(error)) {
                console.log(`[LLM:${correlationId}] Error is recoverable, trying next provider`);
                fallbackUsed = true;
                continue;
            }

            // Non-recoverable error (e.g., invalid request format)
            throw error;
        }
    }

    // All providers failed
    const aggregatedError = new Error('All LLM providers failed');
    aggregatedError.correlation_id = correlationId;
    aggregatedError.provider_errors = errors;
    throw aggregatedError;
}

/**
 * Get provider status for health checks
 * @returns {Promise<Object>}
 */
export async function getProviderStatus() {
    const status = {
        llm_enabled: false,
        primary: null,
        fallback: null,
        persona: 'jarvis',
        fallback_order: LLM_FALLBACK_ORDER,
        providers: {}
    };

    for (const [name, provider] of Object.entries(providers)) {
        const available = await provider.isAvailable();
        status.providers[name] = provider.getStatus();
        status.providers[name].available = available;

        if (available && status.primary === null) {
            status.primary = name;
            status.llm_enabled = true;
        } else if (available && status.fallback === null) {
            status.fallback = name;
        }
    }

    return status;
}

/**
 * Check if any LLM provider is configured
 * @returns {Promise<boolean>}
 */
export async function isConfigured() {
    for (const provider of Object.values(providers)) {
        if (await provider.isAvailable()) {
            return true;
        }
    }
    return false;
}

export { OpenAIProvider, GeminiProvider };
export { LLM_FALLBACK_ORDER };
