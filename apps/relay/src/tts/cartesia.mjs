/**
 * Cartesia TTS Provider (Primary)
 * Real-time voice synthesis via Cartesia WebSocket API
 * @module tts/cartesia
 * 
 * API Reference: https://docs.cartesia.ai/api-reference/tts/stream-speech-websocket
 * 
 * Auth: X-API-Key header
 * Versioning: Cartesia-Version header (2024-06-10)
 */

import { TTSProvider } from './types.mjs';
import { randomUUID } from 'crypto';

const CARTESIA_WS_URL = 'wss://api.cartesia.ai/tts/websocket';
const CARTESIA_VERSION = '2024-06-10';
const DEFAULT_MODEL = 'sonic-english';

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
     * Uses WebSocket with proper X-API-Key header authentication
     * @param {import('./types.mjs').TTSStreamOptions} options
     * @yields {import('./types.mjs').AudioFrame}
     */
    async *stream(options) {
        const correlationId = randomUUID().slice(0, 8);

        if (!await this.isAvailable()) {
            throw new Error(`[${correlationId}] Cartesia not configured (missing API key or voice ID)`);
        }

        const voiceId = options.voiceId || this.voiceId;

        // Cartesia WebSocket with API key in query params (their documented method)
        // AND with Cartesia-Version header
        const wsUrl = `${CARTESIA_WS_URL}?api_key=${encodeURIComponent(this.apiKey)}&cartesia_version=${CARTESIA_VERSION}`;

        let seq = 0;
        const chunks = [];
        let error = null;
        let done = false;
        let contextId = randomUUID();

        // Create WebSocket connection
        const { default: WebSocket } = await import('ws');
        const ws = new WebSocket(wsUrl, {
            headers: {
                'Cartesia-Version': CARTESIA_VERSION
            }
        });

        // Promise-based event handlers
        const wsReady = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`[${correlationId}] Cartesia WS connection timeout`));
            }, 10000);

            ws.once('open', () => {
                clearTimeout(timeout);
                resolve();
            });
            ws.once('error', (e) => {
                clearTimeout(timeout);
                reject(new Error(`[${correlationId}] Cartesia WS error: ${e.message}`));
            });
        });

        ws.on('message', (data) => {
            try {
                // Cartesia can send binary audio data directly
                if (Buffer.isBuffer(data) && !data.toString().startsWith('{')) {
                    chunks.push({
                        data: new Uint8Array(data),
                        seq: seq++,
                        codec: 'pcm_16000',
                        sample_rate_hz: 16000,
                        channels: 1
                    });
                    return;
                }

                const msg = JSON.parse(data.toString());

                if (msg.type === 'chunk') {
                    // Audio data is base64 encoded in chunk.data
                    const audioData = Buffer.from(msg.data, 'base64');
                    chunks.push({
                        data: new Uint8Array(audioData),
                        seq: seq++,
                        codec: 'pcm_16000',
                        sample_rate_hz: 16000,
                        channels: 1
                    });
                } else if (msg.type === 'done') {
                    done = true;
                } else if (msg.type === 'error' || msg.error) {
                    const errMsg = msg.message || msg.error || 'Unknown Cartesia error';
                    error = new Error(`[${correlationId}] Cartesia: ${errMsg}`);
                }
            } catch (e) {
                // If JSON parse fails, might be binary audio
                if (Buffer.isBuffer(data)) {
                    chunks.push({
                        data: new Uint8Array(data),
                        seq: seq++,
                        codec: 'pcm_16000',
                        sample_rate_hz: 16000,
                        channels: 1
                    });
                } else {
                    error = new Error(`[${correlationId}] Cartesia parse error: ${e.message}`);
                }
            }
        });

        ws.on('close', (code, reason) => {
            if (code !== 1000 && !done && !error) {
                error = new Error(`[${correlationId}] Cartesia WS closed: code=${code}`);
            }
            done = true;
        });

        ws.on('error', (e) => {
            error = new Error(`[${correlationId}] Cartesia WS error: ${e.message}`);
            done = true;
        });

        try {
            await wsReady;

            // Send synthesis request per Cartesia API spec
            ws.send(JSON.stringify({
                context_id: contextId,
                model_id: DEFAULT_MODEL,
                transcript: options.text,
                voice: {
                    mode: 'id',
                    id: voiceId
                },
                output_format: {
                    container: 'raw',
                    sample_rate: 16000,
                    encoding: 'pcm_s16le'
                },
                continue: false
            }));

            // Yield chunks as they arrive
            while (!done || chunks.length > 0) {
                if (error) {
                    throw error;
                }

                if (chunks.length > 0) {
                    yield chunks.shift();
                } else if (!done) {
                    await new Promise(r => setTimeout(r, 10));
                }
            }

            // Final error check
            if (error) {
                throw error;
            }
        } finally {
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                ws.close(1000);
            }
        }
    }
}

export default CartesiaTTSProvider;
