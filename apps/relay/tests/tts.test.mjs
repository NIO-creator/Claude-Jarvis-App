/**
 * TTS Provider Unit Tests
 * Tests for provider selection, fallback, and mock mode
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';

describe('Mock TTS Provider', () => {
    before(() => {
        process.env.TTS_MOCK_MODE = 'true';
    });

    it('should generate deterministic audio frames', async () => {
        const { MockTTSProvider } = await import('../src/tts/mock.mjs');
        const provider = new MockTTSProvider();

        // Force enable for this instance
        provider.enabled = true;

        const frames = [];
        for await (const frame of provider.stream({ text: 'Hello world' })) {
            frames.push(frame);
        }

        assert.ok(frames.length > 0, 'Should generate frames');
        assert.ok(frames[0].data instanceof Uint8Array, 'Frame data should be Uint8Array');
        assert.strictEqual(frames[0].seq, 0, 'First frame should have seq 0');
        assert.strictEqual(frames[0].codec, 'pcm_16000', 'Codec should be pcm_16000');
    });

    it('should generate consistent frame count for same text', async () => {
        const { MockTTSProvider } = await import('../src/tts/mock.mjs');
        const provider = new MockTTSProvider();
        provider.enabled = true;

        const text = 'Deterministic test';

        const frames1 = [];
        for await (const frame of provider.stream({ text })) {
            frames1.push(frame);
        }

        const frames2 = [];
        for await (const frame of provider.stream({ text })) {
            frames2.push(frame);
        }

        assert.strictEqual(frames1.length, frames2.length, 'Same frame count');
    });

    it('should stream transcript deltas word by word', async () => {
        const { MockTTSProvider } = await import('../src/tts/mock.mjs');
        const provider = new MockTTSProvider();
        provider.enabled = true;

        const deltas = [];
        for await (const delta of provider.streamTranscript({ text: 'One two three' })) {
            deltas.push(delta);
        }

        assert.strictEqual(deltas.length, 3, 'Should have 3 deltas');
        assert.strictEqual(deltas[2].isFinal, true, 'Last delta should be final');
    });
});

describe('TTS Stream With Fallback (Mock Mode)', () => {
    before(() => {
        process.env.TTS_MOCK_MODE = 'true';
    });

    it('should yield audio events from mock provider', async () => {
        const { streamWithFallback } = await import('../src/tts/index.mjs');

        const events = [];
        for await (const event of streamWithFallback({ text: 'Test streaming' })) {
            events.push(event);
        }

        const audioEvents = events.filter(e => e.type === 'audio');
        assert.ok(audioEvents.length > 0, 'Should have audio events');
        assert.strictEqual(audioEvents[0].provider, 'mock');
    });
});

describe('Provider Interface', () => {
    it('CartesiaTTSProvider should have correct interface', async () => {
        const { CartesiaTTSProvider } = await import('../src/tts/cartesia.mjs');
        const provider = new CartesiaTTSProvider();

        assert.strictEqual(provider.name, 'cartesia');
        assert.strictEqual(typeof provider.isAvailable, 'function');
        assert.strictEqual(typeof provider.stream, 'function');
    });

    it('ElevenLabsTTSProvider should have correct interface', async () => {
        const { ElevenLabsTTSProvider } = await import('../src/tts/elevenlabs.mjs');
        const provider = new ElevenLabsTTSProvider();

        assert.strictEqual(provider.name, 'elevenlabs');
        assert.strictEqual(typeof provider.isAvailable, 'function');
        assert.strictEqual(typeof provider.stream, 'function');
    });

    it('MockTTSProvider should have correct interface', async () => {
        const { MockTTSProvider } = await import('../src/tts/mock.mjs');
        const provider = new MockTTSProvider();

        assert.strictEqual(provider.name, 'mock');
        assert.strictEqual(typeof provider.isAvailable, 'function');
        assert.strictEqual(typeof provider.stream, 'function');
        assert.strictEqual(typeof provider.streamTranscript, 'function');
    });

    it('ElevenLabsTTSProvider should use voiceId not agentId', async () => {
        const { ElevenLabsTTSProvider } = await import('../src/tts/elevenlabs.mjs');
        const provider = new ElevenLabsTTSProvider();

        // Verify voiceId is set (either from env or default)
        assert.ok(provider.voiceId, 'Should have voiceId configured');
        // There should be no agentId property
        assert.strictEqual(provider.agentId, undefined, 'Should NOT have agentId property');
    });
});

describe('Audio Frame Metadata', () => {
    before(() => {
        process.env.TTS_MOCK_MODE = 'true';
    });

    it('Mock provider frames should include sample_rate_hz and channels', async () => {
        const { MockTTSProvider } = await import('../src/tts/mock.mjs');
        const provider = new MockTTSProvider();
        provider.enabled = true;

        const frames = [];
        for await (const frame of provider.stream({ text: 'Metadata test' })) {
            frames.push(frame);
        }

        assert.ok(frames.length > 0, 'Should have frames');

        const frame = frames[0];
        assert.strictEqual(frame.sample_rate_hz, 16000, 'Should have 16kHz sample rate');
        assert.strictEqual(frame.channels, 1, 'Should be mono');
    });
});

describe('Provider Status', () => {
    it('should return status for all providers', async () => {
        const { getProviderStatus } = await import('../src/tts/index.mjs');

        const status = await getProviderStatus();

        assert.ok('cartesia' in status, 'Should have cartesia status');
        assert.ok('elevenlabs' in status, 'Should have elevenlabs status');
        assert.ok('mock' in status, 'Should have mock status');
        assert.ok('activeFallback' in status, 'Should have activeFallback');
    });
});
