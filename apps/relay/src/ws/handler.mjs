/**
 * WebSocket Voice Handler
 * Handles real-time TTS streaming over WebSocket
 * @module ws/handler
 */

import { streamWithFallback, getProviderStatus } from '../tts/index.mjs';
import { appendMessage } from '../services/messages.mjs';
import {
    parseClientMessage,
    createConnectedMessage,
    createSessionBoundMessage,
    createTranscriptDeltaMessage,
    createAudioFrameMessage,
    createAudioEndMessage,
    createErrorMessage,
    createPongMessage,
    createProviderSwitchedMessage,
    ClientMessageType
} from './protocol.mjs';

/**
 * WebSocket client state
 * @typedef {Object} ClientState
 * @property {string|null} userId
 * @property {string|null} sessionId
 * @property {boolean} isSpeaking
 * @property {AbortController|null} speakAbort
 */

/**
 * Create WebSocket handler for Fastify
 * @param {import('fastify').FastifyInstance} app
 */
export function createVoiceHandler(app) {
    return async (socket, request) => {
        const clientId = Math.random().toString(36).substring(7);
        app.log.info({ clientId }, 'Voice WebSocket client connected');

        /** @type {ClientState} */
        const state = {
            userId: null,
            sessionId: null,
            isSpeaking: false,
            speakAbort: null
        };

        // Send connection confirmation
        socket.send(createConnectedMessage());

        socket.on('message', async (raw) => {
            const data = raw.toString();
            app.log.debug({ clientId, msg: 'WS message received', length: data.length });

            const { valid, message, error } = parseClientMessage(data);

            if (!valid) {
                socket.send(createErrorMessage('INVALID_MESSAGE', error));
                return;
            }

            try {
                switch (message.type) {
                    case ClientMessageType.PING:
                        socket.send(createPongMessage());
                        break;

                    case ClientMessageType.SESSION_BIND:
                        await handleSessionBind(socket, state, message, app);
                        break;

                    case ClientMessageType.ASSISTANT_SPEAK:
                        await handleAssistantSpeak(socket, state, message, app);
                        break;
                }
            } catch (err) {
                app.log.error({ clientId, err }, 'Error handling message');
                socket.send(createErrorMessage('INTERNAL_ERROR', 'An error occurred processing your request'));
            }
        });

        socket.on('close', () => {
            app.log.info({ clientId }, 'Voice WebSocket client disconnected');
            // Cancel any ongoing speech
            if (state.speakAbort) {
                state.speakAbort.abort();
            }
        });

        socket.on('error', (err) => {
            app.log.error({ clientId, err }, 'Voice WebSocket error');
        });
    };
}

/**
 * Handle session.bind message
 * @param {WebSocket} socket
 * @param {ClientState} state
 * @param {Object} message
 * @param {import('fastify').FastifyInstance} app
 */
async function handleSessionBind(socket, state, message, app) {
    state.userId = message.user_id;
    state.sessionId = message.session_id;

    app.log.info({
        userId: state.userId,
        sessionId: state.sessionId
    }, 'Session bound');

    socket.send(createSessionBoundMessage(state.userId, state.sessionId));
}

/**
 * Handle assistant.speak message - stream TTS audio
 * @param {WebSocket} socket
 * @param {ClientState} state
 * @param {Object} message
 * @param {import('fastify').FastifyInstance} app
 */
async function handleAssistantSpeak(socket, state, message, app) {
    if (state.isSpeaking) {
        socket.send(createErrorMessage('ALREADY_SPEAKING', 'Already speaking, wait for audio.end'));
        return;
    }

    if (!state.sessionId) {
        socket.send(createErrorMessage('NOT_BOUND', 'Call session.bind first'));
        return;
    }

    const { text, voice_provider: preferredProvider } = message;

    app.log.info({
        sessionId: state.sessionId,
        textLength: text.length,
        preferredProvider
    }, 'Starting TTS stream');

    state.isSpeaking = true;
    state.speakAbort = new AbortController();

    let frameCount = 0;
    let lastProvider = null;

    try {
        // Emit transcript delta immediately (full text, since we have it)
        socket.send(createTranscriptDeltaMessage(text, true));

        // Stream audio frames
        for await (const event of streamWithFallback({ text }, preferredProvider)) {
            // Check for abort
            if (state.speakAbort.signal.aborted) {
                app.log.info({ sessionId: state.sessionId }, 'TTS stream aborted');
                break;
            }

            switch (event.type) {
                case 'audio':
                    socket.send(createAudioFrameMessage(
                        event.frame.data,
                        event.frame.seq,
                        event.frame.codec,
                        event.frame.sample_rate_hz,
                        event.frame.channels
                    ));
                    frameCount++;
                    lastProvider = event.provider;
                    break;

                case 'provider_switched':
                    app.log.warn({
                        from: event.from,
                        to: event.to
                    }, 'TTS provider switched mid-stream');
                    socket.send(createProviderSwitchedMessage(event.from, event.to));
                    break;

                case 'error':
                    app.log.error({
                        provider: event.provider,
                        error: event.error.message
                    }, 'TTS stream error');
                    socket.send(createErrorMessage('TTS_ERROR', 'Voice synthesis failed'));
                    break;
            }
        }

        // Send audio end
        socket.send(createAudioEndMessage(frameCount, lastProvider || 'unknown'));

        // Persist assistant message to transcript
        if (state.sessionId && text) {
            try {
                await appendMessage(state.sessionId, 'assistant', text);
                app.log.debug({ sessionId: state.sessionId }, 'Assistant message persisted');
            } catch (dbErr) {
                app.log.error({ err: dbErr }, 'Failed to persist assistant message');
                // Don't fail the stream for DB errors
            }
        }

        app.log.info({
            sessionId: state.sessionId,
            frameCount,
            provider: lastProvider
        }, 'TTS stream completed');

    } finally {
        state.isSpeaking = false;
        state.speakAbort = null;
    }
}

/**
 * Register voice WebSocket endpoint
 * @param {import('fastify').FastifyInstance} app
 */
export function registerVoiceWebSocket(app) {
    app.get('/ws', { websocket: true }, createVoiceHandler(app));

    // Also add TTS provider status to health endpoint
    app.get('/health/tts', async (request, reply) => {
        const status = await getProviderStatus();
        return {
            status: 'ok',
            tts: status
        };
    });
}
