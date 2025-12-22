/**
 * Fish Audio TTS Provider (Primary)
 * Real-time voice synthesis via Fish Audio API
 * Uses HTTP streaming for TTS generation
 * @module tts/fishaudio
 */

import { TTSProvider } from './types.mjs';

const FISH_AUDIO_API_URL = 'https://api.fish.audio/v1/tts';
const DEFAULT_FORMAT = 'mp3';
const CHUNK_SIZE = 4096; // Bytes per chunk for streaming

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
     * Uses HTTP streaming for real-time audio delivery
     * @param {import('./types.mjs').TTSStreamOptions} options
     * @yields {import('./types.mjs').AudioFrame}
     */
    async *stream(options) {
        if (!await this.isAvailable()) {
            throw new Error('Fish Audio not configured');
        }

        const voiceId = options.voiceId || this.voiceId;
        const format = options.format || DEFAULT_FORMAT;

        // Make HTTP POST request for TTS
        const response = await fetch(FISH_AUDIO_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'model': 's1'  // Fish Audio S1 model
            },
            body: JSON.stringify({
                text: options.text,
                reference_id: voiceId,
                format: format
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Fish Audio API error: ${response.status} - ${errorText}`);
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
