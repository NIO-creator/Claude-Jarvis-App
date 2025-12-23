/**
 * LLM Fallback Unit Tests
 * Tests LLM provider fallback behavior with mocks
 * CI-safe: no live API calls
 * @module tests/llm-fallback.test
 */

import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';

// Mock provider responses
const mockOpenAIResponse = {
    content: 'Hello Sir, I am JARVIS.',
    model: 'gpt-4o',
    provider: 'openai',
    usage: { prompt_tokens: 50, completion_tokens: 20 }
};

const mockGeminiResponse = {
    content: 'Greetings Sir, JARVIS at your service.',
    model: 'gemini-1.5-flash',
    provider: 'gemini',
    usage: { prompt_tokens: 45, completion_tokens: 18 }
};

const mockRequest = {
    messages: [
        { role: 'system', content: 'You are JARVIS.' },
        { role: 'user', content: 'Hello' }
    ]
};

describe('LLM Fallback Tests', () => {
    let originalEnv;

    beforeEach(() => {
        // Save original env
        originalEnv = { ...process.env };
    });

    afterEach(() => {
        // Restore original env
        process.env = originalEnv;
    });

    describe('Provider Availability', () => {
        it('OpenAI available when API key set', async () => {
            process.env.OPENAI_API_KEY = 'test-key';
            const { OpenAIProvider } = await import('../src/llm/providers/openai.mjs');
            const provider = new OpenAIProvider();
            assert.strictEqual(await provider.isAvailable(), true);
        });

        it('OpenAI unavailable when API key missing', async () => {
            delete process.env.OPENAI_API_KEY;
            const { OpenAIProvider } = await import('../src/llm/providers/openai.mjs');
            const provider = new OpenAIProvider();
            // Note: provider reads env at construction time
            assert.strictEqual(typeof provider.apiKey, 'undefined');
        });

        it('Gemini available when API key set', async () => {
            process.env.GEMINI_API_KEY = 'test-key';
            const { GeminiProvider } = await import('../src/llm/providers/gemini.mjs');
            const provider = new GeminiProvider();
            assert.strictEqual(await provider.isAvailable(), true);
        });

        it('Gemini unavailable when API key missing', async () => {
            delete process.env.GEMINI_API_KEY;
            const { GeminiProvider } = await import('../src/llm/providers/gemini.mjs');
            const provider = new GeminiProvider();
            assert.strictEqual(typeof provider.apiKey, 'undefined');
        });
    });

    describe('Message Conversion', () => {
        it('Gemini converts OpenAI messages correctly', async () => {
            process.env.GEMINI_API_KEY = 'test-key';
            const { GeminiProvider } = await import('../src/llm/providers/gemini.mjs');
            const provider = new GeminiProvider();

            const messages = [
                { role: 'system', content: 'You are JARVIS.' },
                { role: 'user', content: 'Hello' },
                { role: 'assistant', content: 'Good day, Sir.' },
                { role: 'user', content: 'Status?' }
            ];

            const { systemInstruction, contents } = provider._convertMessages(messages);

            assert.strictEqual(systemInstruction, 'You are JARVIS.');
            assert.strictEqual(contents.length, 3); // user, model (assistant), user
            assert.strictEqual(contents[0].role, 'user');
            assert.strictEqual(contents[1].role, 'model'); // assistant → model
            assert.strictEqual(contents[2].role, 'user');
        });
    });

    describe('Provider Status', () => {
        it('getProviderStatus returns correct structure', async () => {
            process.env.OPENAI_API_KEY = 'test-key';
            process.env.GEMINI_API_KEY = 'test-key-2';
            // Ensure mock mode is disabled for this test
            delete process.env.LLM_MOCK_MODE;

            // Dynamic import to pick up env changes
            const llmModule = await import('../src/llm/index.mjs');
            const status = await llmModule.getProviderStatus();

            assert.strictEqual(typeof status.llm_enabled, 'boolean');
            assert.strictEqual(status.persona, 'jarvis');
            assert.ok(Array.isArray(status.fallback_order));
            // When not in mock mode, fallback_order should be real providers
            assert.deepStrictEqual(status.fallback_order, ['openai', 'gemini']);
        });
    });

    describe('Fallback Order', () => {
        it('LLM_FALLBACK_ORDER is OpenAI first, Gemini second', async () => {
            const { LLM_FALLBACK_ORDER } = await import('../src/llm/index.mjs');
            assert.deepStrictEqual(LLM_FALLBACK_ORDER, ['openai', 'gemini']);
        });
    });
});

// Run tests
console.log('Running LLM Fallback Tests...');
