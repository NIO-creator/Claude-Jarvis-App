/**
 * TTS Fallback Order Test
 * Tests that the provider fallback chain works correctly
 * Uses mock providers to avoid consuming paid credits
 * @module tests/tts-fallback.test.mjs
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';

// Test the fallback order export
describe('TTS Fallback Order', async () => {
    let ttsModule;

    before(async () => {
        // Import the TTS module
        ttsModule = await import('../src/tts/index.mjs');
    });

    it('should export FALLBACK_ORDER with correct sequence', () => {
        const { FALLBACK_ORDER } = ttsModule;
        assert.ok(Array.isArray(FALLBACK_ORDER), 'FALLBACK_ORDER should be an array');
        assert.deepStrictEqual(
            FALLBACK_ORDER,
            ['fishaudio', 'cartesia', 'elevenlabs'],
            'Fallback order should be: fishaudio → cartesia → elevenlabs'
        );
    });

    it('should return correct fallback chain from fishaudio', () => {
        const { getFallbackChain } = ttsModule;
        const chain = getFallbackChain('fishaudio');
        assert.deepStrictEqual(
            chain,
            ['cartesia', 'elevenlabs'],
            'From fishaudio, fallback should be [cartesia, elevenlabs]'
        );
    });

    it('should return correct fallback chain from cartesia', () => {
        const { getFallbackChain } = ttsModule;
        const chain = getFallbackChain('cartesia');
        assert.deepStrictEqual(
            chain,
            ['elevenlabs'],
            'From cartesia, fallback should be [elevenlabs]'
        );
    });

    it('should return empty fallback chain from elevenlabs (last resort)', () => {
        const { getFallbackChain } = ttsModule;
        const chain = getFallbackChain('elevenlabs');
        assert.deepStrictEqual(
            chain,
            [],
            'From elevenlabs, no further fallback'
        );
    });

    it('should return empty fallback chain for unknown provider', () => {
        const { getFallbackChain } = ttsModule;
        const chain = getFallbackChain('unknown');
        assert.deepStrictEqual(
            chain,
            [],
            'Unknown provider should have no fallback'
        );
    });

    it('should have mock provider available for testing', async () => {
        const { getProvider } = ttsModule;
        const mock = getProvider('mock');
        assert.ok(mock, 'Mock provider should exist');
        assert.strictEqual(mock.name, 'mock', 'Mock provider name should be "mock"');
    });

    it('should get provider status with fallback order', async () => {
        const { getProviderStatus } = ttsModule;
        const status = await getProviderStatus();

        assert.ok(status.fallbackOrder, 'Status should include fallbackOrder');
        assert.deepStrictEqual(
            status.fallbackOrder,
            ['fishaudio', 'cartesia', 'elevenlabs'],
            'Status fallbackOrder should match FALLBACK_ORDER'
        );
    });
});

console.log('Running TTS Fallback Order Tests...\n');
