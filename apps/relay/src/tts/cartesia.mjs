/**
 * Cartesia TTS Provider (Primary)
 * Real-time voice synthesis via Cartesia API
 * @module tts/cartesia
 */

import { TTSProvider } from './types.mjs';

const CARTESIA_API_BASE = 'https://api.cartesia.ai';
const DEFAULT_FORMAT = 'pcm_16000'; // 16kHz PCM for real-time streaming
const CHUNK_SIZE = 4096; // ~128ms at 16kHz mono 16-bit

export class CartesiaTTSProvider extends TTSProvider {
    name = 'cartesia';

    constructor() {
        super();
        this.apiKey = process.env.CARTESIA_API_KEY_MVP;
        this.voiceId = process.env.CARTESIA_VOICE_ID_MVP;
    }

    async isAvailable() {
        return !!(this.apiKey && this.voiceId);
    }

    /**
     * Stream audio frames from Cartesia
     * Uses WebSocket for real-time streaming
     * @param {import('./types.mjs').TTSStreamOptions} options
     * @yields {import('./types.mjs').AudioFrame}
     */
    async *stream(options) {
        if (!await this.isAvailable()) {
            throw new Error('Cartesia not configured');
        }

        const voiceId = options.voiceId || this.voiceId;
        const format = options.format || DEFAULT_FORMAT;

        // Cartesia uses WebSocket for streaming synthesis
        const wsUrl = `wss://api.cartesia.ai/tts/websocket?api_key=${this.apiKey}`;

        let seq = 0;
        const chunks = [];
        let error = null;
        let done = false;

        // Create WebSocket connection
        const { default: WebSocket } = await import('ws');
        const ws = new WebSocket(wsUrl);

        // Promise-based event handlers
        const wsReady = new Promise((resolve, reject) => {
            ws.once('open', () => resolve());
            ws.once('error', (e) => reject(e));
        });

        ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());

                if (msg.type === 'audio') {
                    // Audio data is base64 encoded
                    const audioData = Buffer.from(msg.data, 'base64');
                    chunks.push({
                        data: new Uint8Array(audioData),
                        seq: seq++,
                        codec: format,
                        sample_rate_hz: 16000,  // Matches output_format.sample_rate
                        channels: 1              // Mono
                    });
                } else if (msg.type === 'done') {
                    done = true;
                } else if (msg.type === 'error') {
                    error = new Error(msg.message || 'Cartesia error');
                }
            } catch (e) {
                error = e;
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

            // Send synthesis request
            ws.send(JSON.stringify({
                model_id: 'sonic-english',
                transcript: options.text,
                voice: {
                    mode: 'id',
                    id: voiceId
                },
                output_format: {
                    container: 'raw',
                    sample_rate: 16000,
                    encoding: 'pcm_s16le'
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

export default CartesiaTTSProvider;
