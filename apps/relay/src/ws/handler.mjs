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

    // Extract message fields
    const { text, voice_provider: preferredProvider, tts_disable, correlation_id: providedCorrelationId } = message;

    // Generate correlation_id if not provided
    const correlationId = providedCorrelationId || `tts-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    app.log.info({
        sessionId: state.sessionId,
        correlation_id: correlationId,
        textLength: text.length,
        preferredProvider,
        tts_disable: tts_disable || []
    }, 'Starting TTS stream');

    state.isSpeaking = true;
    state.speakAbort = new AbortController();

    // Telemetry for audio cutting diagnosis
    const streamStartTime = Date.now();
    let frameCount = 0;
    let lastProvider = null;
    let seqStart = null;
    let seqEnd = null;
    let lastSeq = null;
    let missingSeqCount = 0;
    let lastCodec = null;
    let lastSampleRate = null;
    let lastChannels = null;

    /**
     * Safe send that checks readyState before sending
     * @param {string} data - JSON string to send
     * @returns {boolean} - true if sent, false if socket closed
     */
    const safeSend = (data) => {
        if (socket.readyState !== 1) { // 1 = OPEN
            app.log.warn({ readyState: socket.readyState }, 'Socket not open, skipping send');
            return false;
        }
        try {
            socket.send(data);
            return true;
        } catch (err) {
            app.log.error({ err: err.message }, 'Socket send error');
            return false;
        }
    };

    try {
        // Emit transcript delta immediately (full text, since we have it)
        if (!safeSend(createTranscriptDeltaMessage(text, true))) {
            app.log.warn({ sessionId: state.sessionId }, 'Failed to send transcript, connection may be closed');
            return;
        }

        // Stream audio frames
        const streamOptions = {
            preferredProvider,
            tts_disable: tts_disable || [],
            correlation_id: correlationId
        };
        for await (const event of streamWithFallback({ text }, streamOptions)) {
            // Check for abort
            if (state.speakAbort.signal.aborted) {
                app.log.info({ sessionId: state.sessionId }, 'TTS stream aborted');
                break;
            }

            // Check socket is still open before processing event
            if (socket.readyState !== 1) {
                app.log.info({ sessionId: state.sessionId, frameCount }, 'Socket closed mid-stream');
                break;
            }

            switch (event.type) {
                case 'audio':
                    // Track sequence for audio cutting diagnosis
                    const seq = event.frame.seq;
                    if (seqStart === null) seqStart = seq;
                    seqEnd = seq;

                    // Detect missing sequences
                    if (lastSeq !== null && seq !== lastSeq + 1) {
                        missingSeqCount += (seq - lastSeq - 1);
                        app.log.warn({ correlation_id: correlationId, expected: lastSeq + 1, got: seq }, 'Missing audio sequence detected');
                    }
                    lastSeq = seq;

                    // Track codec info for audio.end
                    lastCodec = event.frame.codec;
                    lastSampleRate = event.frame.sample_rate_hz;
                    lastChannels = event.frame.channels;

                    const sent = safeSend(createAudioFrameMessage(
                        event.frame.data,
                        event.frame.seq,
                        event.frame.codec,
                        event.frame.sample_rate_hz,
                        event.frame.channels
                    ));
                    if (!sent) {
                        app.log.warn({ correlation_id: correlationId, frameCount }, 'Failed to send audio frame');
                        return; // Exit early if can't send
                    }
                    frameCount++;
                    lastProvider = event.provider;
                    break;

                case 'provider_switched':
                    app.log.warn({
                        from: event.from,
                        to: event.to
                    }, 'TTS provider switched mid-stream');
                    safeSend(createProviderSwitchedMessage(event.from, event.to, correlationId));
                    break;

                case 'error':
                    app.log.error({
                        provider: event.provider,
                        error: event.error.message
                    }, 'TTS stream error');
                    safeSend(createErrorMessage('TTS_ERROR', 'Voice synthesis failed'));
                    break;
            }
        }

        // Send audio end (only if socket still open) - enhanced with telemetry
        safeSend(createAudioEndMessage(
            frameCount,
            lastProvider || 'unknown',
            lastCodec,
            lastSampleRate,
            lastChannels,
            correlationId
        ));

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

        // Stream summary log for audio cutting diagnosis
        const elapsed_ms = Date.now() - streamStartTime;
        app.log.info({
            correlation_id: correlationId,
            sessionId: state.sessionId,
            provider: lastProvider,
            codec: lastCodec,
            sample_rate_hz: lastSampleRate,
            seq_start: seqStart,
            seq_end: seqEnd,
            total_frames: frameCount,
            missing_seq_count: missingSeqCount,
            elapsed_ms,
            status: 'completed'
        }, 'TTS stream summary');

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
