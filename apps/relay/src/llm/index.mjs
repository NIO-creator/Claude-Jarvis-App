/**
 * LLM Provider Factory
 * Manages provider selection, fallback, and response orchestration
 * @module llm/index
 * 
 * FALLBACK ORDER (MANDATORY):
 * 1. OpenAI (primary)
 * 2. Gemini (fallback)
 * 
 * MOCK MODE:
 * When LLM_MOCK_MODE=true, uses deterministic mock provider only.
 * Enables local dev and CI testing without real API keys.
 */

import { OpenAIProvider } from './providers/openai.mjs';
import { GeminiProvider } from './providers/gemini.mjs';
import { MockProvider } from './providers/mock.mjs';
import { randomUUID } from 'crypto';

/**
 * Check if mock mode is enabled
 * @returns {boolean}
 */
export function getMockMode() {
    return process.env.LLM_MOCK_MODE === 'true';
}

/**
 * Provider instances (singletons)
 */
const providers = {
    mock: new MockProvider(),
    openai: new OpenAIProvider(),
    gemini: new GeminiProvider()
};

/**
 * Explicit fallback order - this defines the priority chain
 * OpenAI first, Gemini second (as mandated)
 */
const LLM_FALLBACK_ORDER = ['openai', 'gemini'];

/**
 * Mock mode uses only the mock provider
 */
const MOCK_FALLBACK_ORDER = ['mock'];

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
 * @param {Object} [options] - Optional configuration
 * @param {string} [options.forceProvider] - Force a specific provider (openai|gemini), bypasses fallback chain
 * @param {string} [options.correlationId] - Use provided correlation ID instead of generating new one
 * @returns {Promise<import('./providers/types.mjs').LLMResponse & { fallback_used: boolean, correlation_id: string }>}
 * @throws {Error} If all providers fail or forced provider fails
 */
export async function generateWithFallback(request, options = {}) {
    const correlationId = options.correlationId || randomUUID();
    const errors = [];
    let fallbackUsed = false;

    // Use mock chain when in mock mode, otherwise use real provider chain
    let providerChain = getMockMode() ? MOCK_FALLBACK_ORDER : LLM_FALLBACK_ORDER;

    // If a specific provider is forced, use only that provider (for testing)
    if (options.forceProvider && providers[options.forceProvider]) {
        console.log(`[LLM:${correlationId}] Forcing provider: ${options.forceProvider}`);
        providerChain = [options.forceProvider];
    }

    for (const providerName of providerChain) {
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

            // Log provider used with correlation
            console.log(`[LLM:${correlationId}] provider_used=${providerName} fallback_used=${fallbackUsed}`);

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
    const mockMode = getMockMode();
    const activeChain = mockMode ? MOCK_FALLBACK_ORDER : LLM_FALLBACK_ORDER;

    const status = {
        llm_enabled: false,
        mock_mode: mockMode,
        primary: null,
        fallback: null,
        persona: 'jarvis',
        fallback_order: activeChain,
        providers: {}
    };

    // In mock mode, only report mock provider; otherwise report real providers
    const activeProviders = mockMode
        ? { mock: providers.mock }
        : { openai: providers.openai, gemini: providers.gemini };

    for (const [name, provider] of Object.entries(activeProviders)) {
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

export { OpenAIProvider, GeminiProvider, MockProvider };
export { LLM_FALLBACK_ORDER, MOCK_FALLBACK_ORDER };
