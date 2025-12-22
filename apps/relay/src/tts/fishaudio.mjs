/**
 * Fish Audio TTS Provider (Primary)
 * Real-time voice synthesis via Fish Audio API
 * @module tts/fishaudio
 */

import { TTSProvider } from './types.mjs';

const FISH_AUDIO_API_BASE = 'https://api.fish.audio';
const DEFAULT_FORMAT = 'pcm';
const DEFAULT_SAMPLE_RATE = 16000;

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
     * Uses WebSocket for real-time streaming
     * @param {import('./types.mjs').TTSStreamOptions} options
     * @yields {import('./types.mjs').AudioFrame}
     */
    async *stream(options) {
        if (!await this.isAvailable()) {
            throw new Error('Fish Audio not configured');
        }

        const voiceId = options.voiceId || this.voiceId;
        const format = options.format || DEFAULT_FORMAT;
        const sampleRate = options.sampleRate || DEFAULT_SAMPLE_RATE;

        // Fish Audio WebSocket endpoint
        const wsUrl = `wss://api.fish.audio/v1/tts/live`;

        let seq = 0;
        const chunks = [];
        let error = null;
        let done = false;

        // Create WebSocket connection
        const { default: WebSocket } = await import('ws');
        const ws = new WebSocket(wsUrl, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`
            }
        });

        // Promise-based event handlers
        const wsReady = new Promise((resolve, reject) => {
            ws.once('open', () => resolve());
            ws.once('error', (e) => reject(e));
        });

        ws.on('message', (data) => {
            try {
                // Check if data is binary (audio) or JSON (control message)
                if (Buffer.isBuffer(data)) {
                    // Binary audio data
                    chunks.push({
                        data: new Uint8Array(data),
                        seq: seq++,
                        codec: format === 'mp3' ? 'mp3' : 'pcm_16000',
                        sample_rate_hz: sampleRate,
                        channels: 1
                    });
                } else {
                    const msg = JSON.parse(data.toString());

                    if (msg.event === 'audio') {
                        // Base64 encoded audio
                        const audioData = Buffer.from(msg.audio, 'base64');
                        chunks.push({
                            data: new Uint8Array(audioData),
                            seq: seq++,
                            codec: format === 'mp3' ? 'mp3' : 'pcm_16000',
                            sample_rate_hz: sampleRate,
                            channels: 1
                        });
                    } else if (msg.event === 'finish' || msg.event === 'done') {
                        done = true;
                    } else if (msg.event === 'error') {
                        error = new Error(msg.message || 'Fish Audio error');
                    }
                }
            } catch (e) {
                // If parse fails, assume it's binary audio data
                if (Buffer.isBuffer(data)) {
                    chunks.push({
                        data: new Uint8Array(data),
                        seq: seq++,
                        codec: format === 'mp3' ? 'mp3' : 'pcm_16000',
                        sample_rate_hz: sampleRate,
                        channels: 1
                    });
                } else {
                    error = e;
                }
            }
        });

        ws.on('close', () => {
            done = true;
        });

        ws.on('error', (e) => {
            error = e;
            done = true;
        });

        try {
            await wsReady;

            // Send start message with configuration
            ws.send(JSON.stringify({
                event: 'start',
                request: {
                    text: options.text,
                    reference_id: voiceId,
                    format: format,
                    sample_rate: sampleRate,
                    latency: 'balanced'  // 'normal' or 'balanced'
                }
            }));

            // Yield chunks as they arrive
            while (!done || chunks.length > 0) {
                if (error) {
                    throw error;
                }

                if (chunks.length > 0) {
                    yield chunks.shift();
                } else if (!done) {
                    // Wait a bit for more data
                    await new Promise(r => setTimeout(r, 10));
                }
            }
        } finally {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        }
    }
}

export default FishAudioTTSProvider;
