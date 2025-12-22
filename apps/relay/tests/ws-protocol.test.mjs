/**
 * WebSocket Protocol Contract Tests
 * Tests for the voice streaming WebSocket protocol
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { WebSocket } from 'ws';
import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { registerVoiceWebSocket } from '../src/ws/handler.mjs';

// Enable mock mode for testing
process.env.TTS_MOCK_MODE = 'true';

describe('WebSocket Protocol', () => {
    let app;
    let baseUrl;

    before(async () => {
        app = Fastify({ logger: false });
        await app.register(websocket);
        registerVoiceWebSocket(app);

        await app.listen({ port: 0, host: '127.0.0.1' });
        const address = app.server.address();
        baseUrl = `ws://127.0.0.1:${address.port}`;
    });

    after(async () => {
        await app.close();
    });

    it('should send connected message on connection', async () => {
        const ws = new WebSocket(`${baseUrl}/ws`);

        const message = await new Promise((resolve, reject) => {
            ws.once('message', (data) => resolve(JSON.parse(data.toString())));
            ws.once('error', reject);
            setTimeout(() => reject(new Error('Timeout')), 5000);
        });

        assert.strictEqual(message.type, 'connected');
        assert.ok(message.version);
        assert.ok(message.timestamp);

        ws.close();
    });

    it('should respond to ping with pong', async () => {
        const ws = new WebSocket(`${baseUrl}/ws`);

        // Wait for connected
        await new Promise(resolve => ws.once('message', resolve));

        // Send ping
        ws.send(JSON.stringify({ type: 'ping' }));

        const response = await new Promise((resolve, reject) => {
            ws.once('message', (data) => resolve(JSON.parse(data.toString())));
            setTimeout(() => reject(new Error('Timeout')), 5000);
        });

        assert.strictEqual(response.type, 'pong');

        ws.close();
    });

    it('should bind session successfully', async () => {
        const ws = new WebSocket(`${baseUrl}/ws`);

        // Wait for connected
        await new Promise(resolve => ws.once('message', resolve));

        // Send session.bind
        ws.send(JSON.stringify({
            type: 'session.bind',
            user_id: 'test-user-123',
            session_id: 'test-session-456'
        }));

        const response = await new Promise((resolve, reject) => {
            ws.once('message', (data) => resolve(JSON.parse(data.toString())));
            setTimeout(() => reject(new Error('Timeout')), 5000);
        });

        assert.strictEqual(response.type, 'session.bound');
        assert.strictEqual(response.user_id, 'test-user-123');
        assert.strictEqual(response.session_id, 'test-session-456');

        ws.close();
    });

    it('should reject assistant.speak without session bind', async () => {
        const ws = new WebSocket(`${baseUrl}/ws`);

        // Wait for connected
        await new Promise(resolve => ws.once('message', resolve));

        // Send speak without binding
        ws.send(JSON.stringify({
            type: 'assistant.speak',
            text: 'Hello'
        }));

        const response = await new Promise((resolve, reject) => {
            ws.once('message', (data) => resolve(JSON.parse(data.toString())));
            setTimeout(() => reject(new Error('Timeout')), 5000);
        });

        assert.strictEqual(response.type, 'error');
        assert.strictEqual(response.code, 'NOT_BOUND');

        ws.close();
    });

    it('should return error for invalid message', async () => {
        const ws = new WebSocket(`${baseUrl}/ws`);

        // Wait for connected
        await new Promise(resolve => ws.once('message', resolve));

        // Send invalid message
        ws.send(JSON.stringify({ type: 'unknown.type' }));

        const response = await new Promise((resolve, reject) => {
            ws.once('message', (data) => resolve(JSON.parse(data.toString())));
            setTimeout(() => reject(new Error('Timeout')), 5000);
        });

        assert.strictEqual(response.type, 'error');
        assert.strictEqual(response.code, 'INVALID_MESSAGE');

        ws.close();
    });
});

describe('Voice Streaming (Mock Mode)', () => {
    let app;
    let baseUrl;

    before(async () => {
        process.env.TTS_MOCK_MODE = 'true';

        app = Fastify({ logger: false });
        await app.register(websocket);
        registerVoiceWebSocket(app);

        await app.listen({ port: 0, host: '127.0.0.1' });
        const address = app.server.address();
        baseUrl = `ws://127.0.0.1:${address.port}`;
    });

    after(async () => {
        await app.close();
    });

    it('should stream audio frames for assistant.speak', async () => {
        const ws = new WebSocket(`${baseUrl}/ws`);
        const messages = [];

        ws.on('message', (data) => {
            messages.push(JSON.parse(data.toString()));
        });

        // Wait for connected
        await new Promise(resolve => {
            const check = () => {
                if (messages.some(m => m.type === 'connected')) resolve();
                else setTimeout(check, 10);
            };
            check();
        });

        // Bind session
        ws.send(JSON.stringify({
            type: 'session.bind',
            user_id: 'test-user',
            session_id: 'test-session'
        }));

        // Wait for bound
        await new Promise(resolve => {
            const check = () => {
                if (messages.some(m => m.type === 'session.bound')) resolve();
                else setTimeout(check, 10);
            };
            check();
        });

        // Request speech
        ws.send(JSON.stringify({
            type: 'assistant.speak',
            text: 'Hello world test'
        }));

        // Wait for audio.end
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout waiting for audio.end')), 10000);
            const check = () => {
                if (messages.some(m => m.type === 'audio.end')) {
                    clearTimeout(timeout);
                    resolve();
                } else {
                    setTimeout(check, 50);
                }
            };
            check();
        });

        ws.close();

        // Verify message sequence
        const transcriptDeltas = messages.filter(m => m.type === 'transcript.delta');
        const audioFrames = messages.filter(m => m.type === 'audio.frame');
        const audioEnds = messages.filter(m => m.type === 'audio.end');

        assert.ok(transcriptDeltas.length >= 1, 'Should have at least 1 transcript delta');
        assert.ok(audioFrames.length >= 1, 'Should have at least 1 audio frame');
        assert.strictEqual(audioEnds.length, 1, 'Should have exactly 1 audio.end');

        // Verify audio frame structure
        const frame = audioFrames[0];
        assert.ok(frame.data_b64, 'Frame should have base64 data');
        assert.ok(frame.codec, 'Frame should have codec');
        assert.strictEqual(typeof frame.seq, 'number', 'Frame should have sequence number');
        assert.strictEqual(typeof frame.sample_rate_hz, 'number', 'Frame should have sample_rate_hz');
        assert.strictEqual(typeof frame.channels, 'number', 'Frame should have channels');
        assert.strictEqual(frame.sample_rate_hz, 16000, 'Mock provider uses 16kHz');
        assert.strictEqual(frame.channels, 1, 'Mock provider uses mono');

        // Verify no file artifacts (sanity check)
        const hasFileContent = audioFrames.some(f => {
            try {
                const decoded = Buffer.from(f.data_b64, 'base64');
                // Check for MP3/WAV file headers
                return decoded.slice(0, 3).toString() === 'ID3' ||
                    decoded.slice(0, 4).toString() === 'RIFF';
            } catch {
                return false;
            }
        });
        assert.ok(!hasFileContent, 'Should not contain file headers - streaming PCM only');
    });

    it('should enforce sequential ordering in frames', async () => {
        const ws = new WebSocket(`${baseUrl}/ws`);
        const messages = [];

        ws.on('message', (data) => {
            messages.push(JSON.parse(data.toString()));
        });

        // Wait for connected
        await new Promise(resolve => setTimeout(resolve, 100));

        // Bind and speak
        ws.send(JSON.stringify({
            type: 'session.bind',
            user_id: 'seq-test-user',
            session_id: 'seq-test-session'
        }));

        await new Promise(resolve => setTimeout(resolve, 100));

        ws.send(JSON.stringify({
            type: 'assistant.speak',
            text: 'Testing frame sequence ordering with multiple words'
        }));

        // Wait for completion
        await new Promise((resolve) => {
            const check = () => {
                if (messages.some(m => m.type === 'audio.end')) resolve();
                else setTimeout(check, 50);
            };
            check();
        });

        ws.close();

        // Verify sequence numbers are in order
        const audioFrames = messages.filter(m => m.type === 'audio.frame');
        for (let i = 0; i < audioFrames.length; i++) {
            assert.strictEqual(audioFrames[i].seq, i, `Frame ${i} should have seq ${i}`);
        }
    });
});
