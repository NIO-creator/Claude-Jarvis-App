/**
 * LLM Provider Base Types
 * @module llm/providers/types
 */

/**
 * @typedef {Object} LLMMessage
 * @property {'system' | 'user' | 'assistant'} role
 * @property {string} content
 */

/**
 * @typedef {Object} LLMRequest
 * @property {LLMMessage[]} messages
 * @property {string} [model]
 * @property {number} [max_tokens]
 * @property {number} [temperature]
 */

/**
 * @typedef {Object} LLMResponse
 * @property {string} content
 * @property {string} model
 * @property {string} provider
 * @property {{ prompt_tokens: number, completion_tokens: number }} usage
 */

/**
 * @typedef {Object} LLMProviderStatus
 * @property {boolean} available
 * @property {boolean} isPrimary
 * @property {string} model
 */

/**
 * Base LLM Provider class
 * All LLM providers must extend this class
 */
export class LLMProvider {
    /** @type {string} */
    name = 'base';

    /**
     * Check if this provider is available (API key configured)
     * @returns {Promise<boolean>}
     */
    async isAvailable() {
        return false;
    }

    /**
     * Generate a response from the LLM
     * @param {LLMRequest} request
     * @returns {Promise<LLMResponse>}
     */
    async generate(request) {
        throw new Error('Not implemented');
    }

    /**
     * Get provider status for health checks
     * @returns {LLMProviderStatus}
     */
    getStatus() {
        return {
            available: false,
            isPrimary: false,
            model: 'unknown'
        };
    }
}

export default LLMProvider;
