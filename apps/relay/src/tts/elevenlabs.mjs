/**
 * ElevenLabs TTS Provider (Fallback)
 * Real-time voice synthesis via ElevenLabs Text-to-Speech API
 * Uses voice_id endpoint, NOT Agents Platform
 * @module tts/elevenlabs
 */

import { TTSProvider } from './types.mjs';

const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';
const DEFAULT_MODEL = 'eleven_turbo_v2_5';


export class ElevenLabsTTSProvider extends TTSProvider {
    name = 'elevenlabs';

    constructor() {
        super();
        // Apply .trim() to handle potential whitespace from secret injection
        const apiKey = (process.env.ELEVENLABS_API_KEY_MVP || process.env.ELEVENLABS_API_KEY || '').trim();
        const voiceId = (process.env.ELEVENLABS_VOICE_ID_MVP || process.env.ELEVENLABS_VOICE_ID || '').trim();

        this.apiKey = apiKey || null;
        // Only use custom voice ID if explicitly set, do NOT fall back to default
        this.voiceId = voiceId || null;

        // Diagnostic logging (no secrets)
        console.log(`[ElevenLabs] Provider initialized - voice_id: ${this.voiceId ? this.voiceId.substring(0, 8) + '...' : 'NOT SET'} (len=${this.voiceId?.length || 0}), api_key_configured: ${!!this.apiKey}`);
    }

    async isAvailable() {
        // Require BOTH API key AND voice ID (no default fallback)
        const available = !!(this.apiKey && this.voiceId);
        if (!available) {
            console.warn(`[ElevenLabs] Not available: api_key=${!!this.apiKey}, voice_id=${!!this.voiceId}`);
        }
        return available;
    }

    /**
     * Stream audio frames from ElevenLabs TTS endpoint
     * Uses /text-to-speech/{voice_id}/stream for progressive MP3 chunks
     * @param {import('./types.mjs').TTSStreamOptions} options
     * @yields {import('./types.mjs').AudioFrame}
     */
    async *stream(options) {
        const correlationId = options.correlation_id || 'el-' + Date.now();

        if (!await this.isAvailable()) {
            console.error(`[TTS:${correlationId}] TTS_NOT_CONFIGURED_ELEVENLABS - missing API key or voice ID`);
            throw new Error('ElevenLabs not configured (requires API key + voice_id)');
        }

        const voiceId = options.voiceId || this.voiceId;

        // Log voice_id proof at stream start
        console.log(`[TTS:${correlationId}] elevenlabs streaming voice_id=${voiceId} (len=${voiceId.length})`);

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
            console.error(`[TTS:${correlationId}] ElevenLabs error: ${response.status} - ${errText}`);
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

