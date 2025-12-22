/**
 * Fish Audio TTS Provider
 * Real-time voice synthesis via Fish Audio HTTP streaming API
 * @module tts/fishaudio
 * 
 * API Reference: https://docs.fish.audio/api-reference/endpoint/tts/text-to-speech
 * 
 * Auth: Authorization: Bearer <api_key>
 * Required Header: model: 's1' (or 'speech-1.6', 'speech-1.5')
 * Body: { text, reference_id (optional), format }
 */

import { TTSProvider } from './types.mjs';
import { randomUUID } from 'crypto';

const FISH_AUDIO_API_URL = 'https://api.fish.audio/v1/tts';
const DEFAULT_MODEL = 's1';  // Required header - Fish Audio's recommended model
const DEFAULT_FORMAT = 'mp3';
const CHUNK_SIZE = 4096;

export class FishAudioTTSProvider extends TTSProvider {
    name = 'fishaudio';

    constructor() {
        super();
        this.apiKey = process.env.FISH_AUDIO_API_KEY_MVP;
        // Voice ID is optional - if not provided, Fish Audio uses default voice
        this.voiceId = process.env.FISH_AUDIO_VOICE_ID_MVP || null;
    }

    async isAvailable() {
        // Only API key is required - reference_id is optional
        return !!this.apiKey;
    }

    /**
     * Stream audio frames from Fish Audio
     * Uses HTTP streaming with proper authorization
     * @param {import('./types.mjs').TTSStreamOptions} options
     * @yields {import('./types.mjs').AudioFrame}
     */
    async *stream(options) {
        const correlationId = randomUUID().slice(0, 8);

        if (!await this.isAvailable()) {
            throw new Error(`[${correlationId}] Fish Audio not configured (missing API key)`);
        }

        const voiceId = options.voiceId || this.voiceId;
        const format = options.format || DEFAULT_FORMAT;

        // Build request body per Fish Audio OpenAPI spec
        const requestBody = {
            text: options.text,
            format: format,
            latency: 'normal'
        };

        // reference_id is optional - only include if we have a valid voice ID
        if (voiceId) {
            requestBody.reference_id = voiceId;
        }

        let response;
        try {
            response = await fetch(FISH_AUDIO_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'Accept': 'audio/mpeg',
                    'model': DEFAULT_MODEL  // REQUIRED header per OpenAPI spec
                },
                body: JSON.stringify(requestBody)
            });
        } catch (fetchErr) {
            throw new Error(`[${correlationId}] Fish Audio fetch error: ${fetchErr.message}`);
        }

        if (!response.ok) {
            let errorDetail = '';
            try {
                const errorBody = await response.text();
                // Sanitize - don't include full error body which might contain sensitive info
                errorDetail = errorBody.slice(0, 200);
            } catch { }
            throw new Error(`[${correlationId}] Fish Audio API error: HTTP ${response.status} - ${errorDetail}`);
        }

        // Stream the response body
        const reader = response.body.getReader();
        let seq = 0;
        let buffer = new Uint8Array(0);

        try {
            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    // Yield any remaining data in buffer
                    if (buffer.length > 0) {
                        yield {
                            data: buffer,
                            seq: seq++,
                            codec: format === 'mp3' ? 'mp3' : 'pcm_16000',
                            sample_rate_hz: format === 'mp3' ? 44100 : 16000,
                            channels: 1
                        };
                    }
                    break;
                }

                // Append to buffer
                const newBuffer = new Uint8Array(buffer.length + value.length);
                newBuffer.set(buffer);
                newBuffer.set(value, buffer.length);
                buffer = newBuffer;

                // Yield chunks when buffer is large enough
                while (buffer.length >= CHUNK_SIZE) {
                    const chunk = buffer.slice(0, CHUNK_SIZE);
                    buffer = buffer.slice(CHUNK_SIZE);

                    yield {
                        data: chunk,
                        seq: seq++,
                        codec: format === 'mp3' ? 'mp3' : 'pcm_16000',
                        sample_rate_hz: format === 'mp3' ? 44100 : 16000,
                        channels: 1
                    };
                }
            }
        } finally {
            reader.releaseLock();
        }
    }
}

export default FishAudioTTSProvider;
