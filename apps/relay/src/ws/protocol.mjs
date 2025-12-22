/**
 * WebSocket Protocol Types
 * Versioned message format for JARVIS voice streaming
 * @module ws/protocol
 * @version 1.0.0
 */

export const PROTOCOL_VERSION = '1.0.0';

/**
 * Client → Relay message types
 */
export const ClientMessageType = {
    SESSION_BIND: 'session.bind',
    ASSISTANT_SPEAK: 'assistant.speak',
    PING: 'ping'
};

/**
 * Relay → Client message types
 */
export const RelayMessageType = {
    // Connection lifecycle
    CONNECTED: 'connected',
    SESSION_BOUND: 'session.bound',
    PONG: 'pong',

    // Voice streaming
    TRANSCRIPT_DELTA: 'transcript.delta',
    AUDIO_FRAME: 'audio.frame',
    AUDIO_END: 'audio.end',

    // Status
    ERROR: 'error',
    PROVIDER_SWITCHED: 'provider.switched'
};

/**
 * Audio frame encoding mode
 * Using base64 for JSON compatibility (vs binary frames)
 * Rationale: Simplifies debugging, compatible with all WS libs
 */
export const AUDIO_ENCODING = 'base64';

/**
 * Validate and parse client message
 * @param {string} raw - Raw message string
 * @returns {{ valid: boolean, message?: Object, error?: string }}
 */
export function parseClientMessage(raw) {
    try {
        const msg = JSON.parse(raw);

        if (!msg.type) {
            return { valid: false, error: 'Missing message type' };
        }

        // Validate known message types
        switch (msg.type) {
            case ClientMessageType.SESSION_BIND:
                if (!msg.user_id || !msg.session_id) {
                    return { valid: false, error: 'session.bind requires user_id and session_id' };
                }
                break;

            case ClientMessageType.ASSISTANT_SPEAK:
                if (!msg.text || typeof msg.text !== 'string') {
                    return { valid: false, error: 'assistant.speak requires text string' };
                }
                break;

            case ClientMessageType.PING:
                // No additional validation
                break;

            default:
                return { valid: false, error: `Unknown message type: ${msg.type}` };
        }

        return { valid: true, message: msg };
    } catch (e) {
        return { valid: false, error: 'Invalid JSON' };
    }
}

/**
 * Create a connected message
 * @returns {string}
 */
export function createConnectedMessage() {
    return JSON.stringify({
        type: RelayMessageType.CONNECTED,
        version: PROTOCOL_VERSION,
        timestamp: new Date().toISOString()
    });
}

/**
 * Create a session bound message
 * @param {string} userId
 * @param {string} sessionId
 * @returns {string}
 */
export function createSessionBoundMessage(userId, sessionId) {
    return JSON.stringify({
        type: RelayMessageType.SESSION_BOUND,
        user_id: userId,
        session_id: sessionId,
        timestamp: new Date().toISOString()
    });
}

/**
 * Create a transcript delta message
 * @param {string} text - Partial text
 * @param {boolean} isFinal - Whether this is the final chunk
 * @returns {string}
 */
export function createTranscriptDeltaMessage(text, isFinal = false) {
    return JSON.stringify({
        type: RelayMessageType.TRANSCRIPT_DELTA,
        text,
        is_final: isFinal,
        timestamp: new Date().toISOString()
    });
}

/**
 * Create an audio frame message
 * @param {Uint8Array} data - Raw audio bytes
 * @param {number} seq - Sequence number
 * @param {string} codec - Audio codec identifier (e.g., 'pcm_16000', 'mp3')
 * @param {number} [sampleRateHz] - Sample rate in Hz (e.g., 16000, 44100)
 * @param {number} [channels] - Number of audio channels (1 = mono, 2 = stereo)
 * @returns {string}
 */
export function createAudioFrameMessage(data, seq, codec, sampleRateHz, channels) {
    // Convert to base64 for JSON transport
    const dataB64 = Buffer.from(data).toString('base64');

    const message = {
        type: RelayMessageType.AUDIO_FRAME,
        data_b64: dataB64,
        codec,
        seq,
        timestamp: new Date().toISOString()
    };

    // Include sample rate and channels if provided
    if (sampleRateHz !== undefined) {
        message.sample_rate_hz = sampleRateHz;
    }
    if (channels !== undefined) {
        message.channels = channels;
    }

    return JSON.stringify(message);
}

/**
 * Create an audio end message
 * @param {number} totalFrames - Total frames sent
 * @param {string} provider - Which TTS provider was used
 * @returns {string}
 */
export function createAudioEndMessage(totalFrames, provider) {
    return JSON.stringify({
        type: RelayMessageType.AUDIO_END,
        total_frames: totalFrames,
        provider,
        timestamp: new Date().toISOString()
    });
}

/**
 * Create an error message
 * @param {string} code - Error code
 * @param {string} message - Error message (sanitized, no secrets)
 * @returns {string}
 */
export function createErrorMessage(code, message) {
    return JSON.stringify({
        type: RelayMessageType.ERROR,
        code,
        message,
        timestamp: new Date().toISOString()
    });
}

/**
 * Create a pong message
 * @returns {string}
 */
export function createPongMessage() {
    return JSON.stringify({
        type: RelayMessageType.PONG,
        timestamp: new Date().toISOString()
    });
}

/**
 * Create a provider switched message
 * @param {string} from - Previous provider
 * @param {string} to - New provider  
 * @returns {string}
 */
export function createProviderSwitchedMessage(from, to) {
    return JSON.stringify({
        type: RelayMessageType.PROVIDER_SWITCHED,
        from,
        to,
        timestamp: new Date().toISOString()
    });
}
