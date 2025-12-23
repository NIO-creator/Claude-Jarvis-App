/**
 * Mock LLM Provider - Deterministic responses for local dev and CI
 * @module llm/providers/mock
 * 
 * Enables end-to-end testing without real LLM API keys.
 * Produces stable, JARVIS-persona responses seeded by user input hash.
 */

import { LLMProvider } from './types.mjs';
import { createHash } from 'crypto';

/**
 * Simple deterministic hash function for seed generation
 * @param {string} input 
 * @returns {number}
 */
function hashInput(input) {
    const hash = createHash('md5').update(input).digest('hex');
    // Convert first 8 hex chars to number for stable indexing
    return parseInt(hash.substring(0, 8), 16);
}

/**
 * Extract user_role from system message if present
 * @param {string} systemContent 
 * @returns {string|null}
 */
function extractUserRole(systemContent) {
    // Look for "user_role:" in the memory section
    const match = systemContent.match(/user_role:\s*"([^"]+)"/);
    return match ? match[1] : null;
}

/**
 * Get the user's current input from the last user message
 * @param {Array<{role: string, content: string}>} messages 
 * @returns {string}
 */
function extractUserInput(messages) {
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'user') {
            return messages[i].content;
        }
    }
    return '';
}

/**
 * Response templates with placeholders
 * Each includes "Sir" as per JARVIS persona requirements
 */
const RESPONSE_TEMPLATES = [
    'Very good, Sir. I\'ve processed your request regarding "{input}". Shall I proceed with any specific actions?',
    'Certainly, Sir. Your inquiry about "{input}" has been acknowledged. How may I assist you further?',
    'Understood, Sir. I can confirm your message "{input}" has been received and noted. Is there anything else?',
    'Of course, Sir. I\'ve taken note of "{input}". Would you like me to elaborate on any particular aspect?',
    'At once, Sir. Your request concerning "{input}" is being handled. Shall I provide additional details?',
    'Indeed, Sir. I\'m attending to your query about "{input}". May I suggest any follow-up actions?',
    'Right away, Sir. I\'ve registered your input regarding "{input}". What would you like me to focus on next?',
    'Noted, Sir. Your communication about "{input}" has been recorded. How shall we proceed?'
];

/**
 * Templates that include user role reference
 */
const ROLE_AWARE_TEMPLATES = [
    'Very good, Sir. As your {role}, I\'ve processed your request regarding "{input}". Shall I proceed?',
    'Certainly, Sir. Given your role as {role}, I\'ve noted your inquiry about "{input}". How may I assist?',
    'Understood, Sir. In my capacity serving you as {role}, I\'ve acknowledged "{input}". What else may I do?',
    'Of course, Sir. Recognizing you as {role}, I\'ve taken note of "{input}". Shall I elaborate further?'
];

export class MockProvider extends LLMProvider {
    name = 'mock';

    constructor() {
        super();
        this.mockMode = process.env.LLM_MOCK_MODE === 'true';
    }

    /**
     * Mock is available when LLM_MOCK_MODE=true
     * @returns {Promise<boolean>}
     */
    async isAvailable() {
        return this.mockMode;
    }

    /**
     * Generate a deterministic mock response
     * @param {import('./types.mjs').LLMRequest} request
     * @returns {Promise<import('./types.mjs').LLMResponse>}
     */
    async generate(request) {
        if (!await this.isAvailable()) {
            throw new Error('Mock provider not enabled. Set LLM_MOCK_MODE=true');
        }

        const messages = request.messages || [];
        const userInput = extractUserInput(messages);
        const systemMessage = messages.find(m => m.role === 'system');
        const userRole = systemMessage ? extractUserRole(systemMessage.content) : null;

        // Generate deterministic index from user input
        const hash = hashInput(userInput);

        let responseText;
        if (userRole) {
            // Use role-aware template if user_role is present
            const template = ROLE_AWARE_TEMPLATES[hash % ROLE_AWARE_TEMPLATES.length];
            responseText = template
                .replace('{role}', userRole)
                .replace('{input}', userInput.substring(0, 50));
        } else {
            // Use standard template
            const template = RESPONSE_TEMPLATES[hash % RESPONSE_TEMPLATES.length];
            responseText = template.replace('{input}', userInput.substring(0, 50));
        }

        console.log(`[Mock] Generated deterministic response for input: "${userInput.substring(0, 30)}..."`);

        // Simulate small latency for realistic testing
        await new Promise(resolve => setTimeout(resolve, 50));

        return {
            content: responseText,
            model: 'mock-jarvis-v1',
            provider: this.name,
            usage: {
                prompt_tokens: messages.reduce((sum, m) => sum + (m.content?.length || 0), 0),
                completion_tokens: responseText.length
            }
        };
    }

    getStatus() {
        return {
            available: this.mockMode,
            isPrimary: this.mockMode,
            model: 'mock-jarvis-v1'
        };
    }
}

export default MockProvider;
