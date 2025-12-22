/**
 * ElevenLabs TTS Provider (Fallback)
 * Real-time voice synthesis via ElevenLabs Text-to-Speech API
 * Uses voice_id endpoint, NOT Agents Platform
 * @module tts/elevenlabs
 */

import { TTSProvider } from './types.mjs';

const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';
const DEFAULT_MODEL = 'eleven_turbo_v2_5';
// Default voice: Bella (clear, professional female voice)
const DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL';

export class ElevenLabsTTSProvider extends TTSProvider {
    name = 'elevenlabs';

    constructor() {
        super();
        this.apiKey = process.env.ELEVENLABS_API_KEY_MVP || process.env.ELEVENLABS_API_KEY;
        // Use VOICE_ID, not AGENT_ID (no Agents Platform dependency)
        this.voiceId = process.env.ELEVENLABS_VOICE_ID_MVP || DEFAULT_VOICE_ID;
    }

    async isAvailable() {
        // Only require API key and voice ID (no agent_id)
        return !!(this.apiKey && this.voiceId);
    }

    /**
     * Stream audio frames from ElevenLabs TTS endpoint
     * Uses /text-to-speech/{voice_id}/stream for progressive MP3 chunks
     * @param {import('./types.mjs').TTSStreamOptions} options
     * @yields {import('./types.mjs').AudioFrame}
     */
    async *stream(options) {
        if (!await this.isAvailable()) {
            throw new Error('ElevenLabs not configured (requires API key + voice_id)');
        }

        const voiceId = options.voiceId || this.voiceId;

        // Text-to-Speech streaming endpoint (NOT Agents Platform)
        const url = `${ELEVENLABS_API_BASE}/text-to-speech/${voiceId}/stream`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Accept': 'audio/mpeg',
                'Content-Type': 'application/json',
                'xi-api-key': this.apiKey
            },
            body: JSON.stringify({
                text: options.text,
                model_id: DEFAULT_MODEL,
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75
                }
            })
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => 'Unknown error');
            throw new Error(`ElevenLabs TTS error: ${response.status} - ${errText}`);
        }

        const reader = response.body.getReader();
        let seq = 0;

        try {
            while (true) {
                const { done, value } = await reader.read();

                if (done) break;

                // Yield audio chunk with full codec metadata
                yield {
                    data: new Uint8Array(value),
                    seq: seq++,
                    codec: 'mp3',
                    sample_rate_hz: 44100,  // ElevenLabs default MP3 sample rate
                    channels: 1              // Mono
                };
            }
        } finally {
            reader.releaseLock();
        }
    }
}

export default ElevenLabsTTSProvider;

