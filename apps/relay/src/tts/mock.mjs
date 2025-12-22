/**
 * Mock TTS Provider (CI Testing)
 * Generates deterministic synthetic audio frames for testing
 * @module tts/mock
 */

import { TTSProvider } from './types.mjs';

const MOCK_SAMPLE_RATE = 16000;
const MOCK_CHANNELS = 1;
const MOCK_BITS_PER_SAMPLE = 16;
const BYTES_PER_SAMPLE = MOCK_BITS_PER_SAMPLE / 8;
const CHUNK_DURATION_MS = 50; // 50ms chunks
const CHUNK_SAMPLES = (MOCK_SAMPLE_RATE * CHUNK_DURATION_MS) / 1000;
const CHUNK_BYTES = CHUNK_SAMPLES * BYTES_PER_SAMPLE * MOCK_CHANNELS;

/**
 * Generate a sine wave for testing
 * @param {number} frequency - Frequency in Hz
 * @param {number} samples - Number of samples
 * @param {number} offset - Sample offset for continuity
 * @returns {Int16Array}
 */
function generateSineWave(frequency, samples, offset = 0) {
    const buffer = new Int16Array(samples);
    const amplitude = 16384; // 50% of max 16-bit value

    for (let i = 0; i < samples; i++) {
        const t = (offset + i) / MOCK_SAMPLE_RATE;
        buffer[i] = Math.floor(amplitude * Math.sin(2 * Math.PI * frequency * t));
    }

    return buffer;
}

export class MockTTSProvider extends TTSProvider {
    name = 'mock';

    constructor() {
        super();
        this.enabled = process.env.TTS_MOCK_MODE === 'true';
    }

    async isAvailable() {
        return this.enabled;
    }

    /**
     * Stream synthetic audio frames
     * Generates deterministic sine wave data based on text hash
     * @param {import('./types.mjs').TTSStreamOptions} options
     * @yields {import('./types.mjs').AudioFrame}
     */
    async *stream(options) {
        if (!this.enabled) {
            throw new Error('Mock TTS not enabled (set TTS_MOCK_MODE=true)');
        }

        // Deterministic duration based on text length (~100ms per word)
        const wordCount = options.text.split(/\s+/).length;
        const durationMs = Math.max(500, wordCount * 100);
        const totalChunks = Math.ceil(durationMs / CHUNK_DURATION_MS);

        // Deterministic frequency based on text hash
        const textHash = options.text.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        const frequency = 200 + (textHash % 400); // 200-600 Hz range

        let seq = 0;
        let sampleOffset = 0;

        for (let chunk = 0; chunk < totalChunks; chunk++) {
            // Simulate network latency (10-30ms)
            await new Promise(r => setTimeout(r, 10 + Math.random() * 20));

            const samples = generateSineWave(frequency, CHUNK_SAMPLES, sampleOffset);
            sampleOffset += CHUNK_SAMPLES;

            yield {
                data: new Uint8Array(samples.buffer),
                seq: seq++,
                codec: 'pcm_16000',
                sample_rate_hz: MOCK_SAMPLE_RATE,  // 16000
                channels: MOCK_CHANNELS             // 1 (mono)
            };
        }
    }

    /**
     * Stream transcript deltas (word by word for testing)
     * @param {import('./types.mjs').TTSStreamOptions} options
     * @yields {import('./types.mjs').TextDelta}
     */
    async *streamTranscript(options) {
        const words = options.text.split(/\s+/);

        for (let i = 0; i < words.length; i++) {
            await new Promise(r => setTimeout(r, 50)); // Simulate streaming
            yield {
                text: words[i] + (i < words.length - 1 ? ' ' : ''),
                isFinal: i === words.length - 1
            };
        }
    }
}

export default MockTTSProvider;
