/**
 * Fish Audio TTS Provider
 * Real-time voice synthesis via Fish Audio HTTP streaming API
 * @module tts/fishaudio
 * 
 * API Reference: https://fish.audio/
 * 
 * Auth: Authorization: Bearer <api_key>
 * Endpoint: POST https://api.fish.audio/v1/tts
 * Body: { text, reference_id, format }
 */

import { TTSProvider } from './types.mjs';
import { randomUUID } from 'crypto';

const FISH_AUDIO_API_URL = 'https://api.fish.audio/v1/tts';
const DEFAULT_FORMAT = 'mp3';
const CHUNK_SIZE = 4096;

export class FishAudioTTSProvider extends TTSProvider {
    name = 'fishaudio';

    constructor() {
        super();
        this.apiKey = process.env.FISH_AUDIO_API_KEY_MVP;
        this.voiceId = process.env.FISH_AUDIO_VOICE_ID_MVP;
    }

    async isAvailable() {
        return !!(this.apiKey && this.voiceId);
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
            throw new Error(`[${correlationId}] Fish Audio not configured (missing API key or voice ID)`);
        }

        const voiceId = options.voiceId || this.voiceId;
        const format = options.format || DEFAULT_FORMAT;

        // Fish Audio accepts JSON body with text and reference_id
        // DO NOT send model as a header - it goes in body
        const requestBody = {
            text: options.text,
            reference_id: voiceId,
            format: format,
            latency: 'normal'
        };

        let response;
        try {
            response = await fetch(FISH_AUDIO_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'Accept': 'audio/mpeg'
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
