/**
 * LLM Mock Mode Unit Tests
 * Tests deterministic mock LLM provider behavior
 * CI-safe: no live API calls
 * @module tests/llm-mock.test
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

describe('LLM Mock Mode Tests', () => {
    let originalEnv;

    beforeEach(() => {
        // Save original env
        originalEnv = { ...process.env };
        // Clear all LLM-related env vars to ensure isolation
        delete process.env.OPENAI_API_KEY;
        delete process.env.GEMINI_API_KEY;
    });

    afterEach(() => {
        // Restore original env
        process.env = originalEnv;
    });

    describe('Mock Provider Availability', () => {
        it('Mock provider is available when LLM_MOCK_MODE=true', async () => {
            process.env.LLM_MOCK_MODE = 'true';
            // Fresh import to pick up env changes
            const { MockProvider } = await import('../src/llm/providers/mock.mjs');
            const provider = new MockProvider();
            assert.strictEqual(await provider.isAvailable(), true);
        });

        it('Mock provider is not available when LLM_MOCK_MODE=false', async () => {
            process.env.LLM_MOCK_MODE = 'false';
            const { MockProvider } = await import('../src/llm/providers/mock.mjs');
            const provider = new MockProvider();
            assert.strictEqual(await provider.isAvailable(), false);
        });

        it('Mock provider is not available when LLM_MOCK_MODE is unset', async () => {
            delete process.env.LLM_MOCK_MODE;
            const { MockProvider } = await import('../src/llm/providers/mock.mjs');
            const provider = new MockProvider();
            assert.strictEqual(await provider.isAvailable(), false);
        });
    });

    describe('Deterministic Response Generation', () => {
        it('Same input produces same output (deterministic)', async () => {
            process.env.LLM_MOCK_MODE = 'true';
            const { MockProvider } = await import('../src/llm/providers/mock.mjs');
            const provider = new MockProvider();

            const request = {
                messages: [
                    { role: 'system', content: 'You are JARVIS.' },
                    { role: 'user', content: 'Hello there' }
                ]
            };

            const response1 = await provider.generate(request);
            const response2 = await provider.generate(request);

            assert.strictEqual(response1.content, response2.content, 'Same input should produce same output');
        });

        it('Different input produces different output', async () => {
            process.env.LLM_MOCK_MODE = 'true';
            const { MockProvider } = await import('../src/llm/providers/mock.mjs');
            const provider = new MockProvider();

            const request1 = {
                messages: [
                    { role: 'system', content: 'You are JARVIS.' },
                    { role: 'user', content: 'Hello there' }
                ]
            };

            const request2 = {
                messages: [
                    { role: 'system', content: 'You are JARVIS.' },
                    { role: 'user', content: 'What is the weather?' }
                ]
            };

            const response1 = await provider.generate(request1);
            const response2 = await provider.generate(request2);

            // Different inputs should produce outputs with different embedded input text
            assert.ok(response1.content.includes('Hello'), 'Response 1 should include input');
            assert.ok(response2.content.includes('weather'), 'Response 2 should include input');
        });
    });

    describe('JARVIS Persona Enforcement', () => {
        it('Response includes "Sir" (JARVIS persona)', async () => {
            process.env.LLM_MOCK_MODE = 'true';
            const { MockProvider } = await import('../src/llm/providers/mock.mjs');
            const provider = new MockProvider();

            const request = {
                messages: [
                    { role: 'system', content: 'You are JARVIS.' },
                    { role: 'user', content: 'Hello' }
                ]
            };

            const response = await provider.generate(request);
            assert.ok(response.content.includes('Sir'), 'Response must include "Sir"');
        });

        it('Provider name is "mock"', async () => {
            process.env.LLM_MOCK_MODE = 'true';
            const { MockProvider } = await import('../src/llm/providers/mock.mjs');
            const provider = new MockProvider();

            const request = {
                messages: [
                    { role: 'system', content: 'You are JARVIS.' },
                    { role: 'user', content: 'Hello' }
                ]
            };

            const response = await provider.generate(request);
            assert.strictEqual(response.provider, 'mock');
        });

        it('Model is "mock-jarvis-v1"', async () => {
            process.env.LLM_MOCK_MODE = 'true';
            const { MockProvider } = await import('../src/llm/providers/mock.mjs');
            const provider = new MockProvider();

            const request = {
                messages: [
                    { role: 'system', content: 'You are JARVIS.' },
                    { role: 'user', content: 'Hello' }
                ]
            };

            const response = await provider.generate(request);
            assert.strictEqual(response.model, 'mock-jarvis-v1');
        });
    });

    describe('Memory Fact Integration', () => {
        it('Response references user_role when present in system message', async () => {
            process.env.LLM_MOCK_MODE = 'true';
            const { MockProvider } = await import('../src/llm/providers/mock.mjs');
            const provider = new MockProvider();

            const request = {
                messages: [
                    {
                        role: 'system',
                        content: 'You are JARVIS.\n\n## User Memory\nThe following facts are known about the user:\n- user_role: "Software Engineer"\n- name: "Tony"'
                    },
                    { role: 'user', content: 'Give me a status update' }
                ]
            };

            const response = await provider.generate(request);

            // Response should reference the user's role
            assert.ok(
                response.content.includes('Software Engineer'),
                `Response should reference user_role. Got: ${response.content}`
            );
        });

        it('Response works without memory facts', async () => {
            process.env.LLM_MOCK_MODE = 'true';
            const { MockProvider } = await import('../src/llm/providers/mock.mjs');
            const provider = new MockProvider();

            const request = {
                messages: [
                    { role: 'system', content: 'You are JARVIS.' },
                    { role: 'user', content: 'Hello' }
                ]
            };

            const response = await provider.generate(request);
            assert.ok(response.content.length > 0, 'Should generate response without memory facts');
            assert.ok(response.content.includes('Sir'), 'Should still include Sir');
        });
    });

    describe('getMockMode Function', () => {
        it('getMockMode returns true when LLM_MOCK_MODE=true', async () => {
            process.env.LLM_MOCK_MODE = 'true';
            const { getMockMode } = await import('../src/llm/index.mjs');
            assert.strictEqual(getMockMode(), true);
        });

        it('getMockMode returns false when LLM_MOCK_MODE=false', async () => {
            process.env.LLM_MOCK_MODE = 'false';
            const { getMockMode } = await import('../src/llm/index.mjs');
            assert.strictEqual(getMockMode(), false);
        });
    });

    describe('Provider Status', () => {
        it('getProviderStatus includes mock_mode flag', async () => {
            process.env.LLM_MOCK_MODE = 'true';
            const { getProviderStatus } = await import('../src/llm/index.mjs');
            const status = await getProviderStatus();

            assert.strictEqual(status.mock_mode, true);
            assert.strictEqual(status.primary, 'mock');
            assert.deepStrictEqual(status.fallback_order, ['mock']);
        });

        it('getProviderStatus shows mock as primary when mock mode enabled', async () => {
            process.env.LLM_MOCK_MODE = 'true';
            const { getProviderStatus } = await import('../src/llm/index.mjs');
            const status = await getProviderStatus();

            assert.strictEqual(status.primary, 'mock');
            assert.strictEqual(status.llm_enabled, true);
        });
    });

    describe('Error Handling', () => {
        it('Throws error when generating without mock mode enabled', async () => {
            process.env.LLM_MOCK_MODE = 'false';
            const { MockProvider } = await import('../src/llm/providers/mock.mjs');
            const provider = new MockProvider();

            const request = {
                messages: [
                    { role: 'system', content: 'You are JARVIS.' },
                    { role: 'user', content: 'Hello' }
                ]
            };

            await assert.rejects(
                () => provider.generate(request),
                /Mock provider not enabled/
            );
        });
    });

    describe('Usage Statistics', () => {
        it('Returns usage statistics in response', async () => {
            process.env.LLM_MOCK_MODE = 'true';
            const { MockProvider } = await import('../src/llm/providers/mock.mjs');
            const provider = new MockProvider();

            const request = {
                messages: [
                    { role: 'system', content: 'You are JARVIS.' },
                    { role: 'user', content: 'Hello' }
                ]
            };

            const response = await provider.generate(request);

            assert.ok(response.usage, 'Response should include usage');
            assert.ok(typeof response.usage.prompt_tokens === 'number', 'Should have prompt_tokens');
            assert.ok(typeof response.usage.completion_tokens === 'number', 'Should have completion_tokens');
        });
    });
});

// Run tests
console.log('Running LLM Mock Mode Tests...');
