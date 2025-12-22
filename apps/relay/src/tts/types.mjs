/**
 * TTS Provider Types and Interfaces
 * @module tts/types
 */

/**
 * Audio frame emitted during streaming
 * @typedef {Object} AudioFrame
 * @property {Uint8Array} data - Raw audio bytes
 * @property {number} seq - Sequence number for ordering
 * @property {string} codec - Audio codec (e.g., 'pcm_16000', 'mp3')
 */

/**
 * Text delta for transcript updates
 * @typedef {Object} TextDelta
 * @property {string} text - Partial text content
 * @property {boolean} isFinal - Whether this is the final chunk
 */

/**
 * TTS streaming options
 * @typedef {Object} TTSStreamOptions
 * @property {string} text - Text to synthesize
 * @property {string} [voiceId] - Voice ID override
 * @property {string} [format] - Audio format (default: pcm_16000)
 */

/**
 * TTS Provider interface
 * All providers must implement this interface
 */
export class TTSProvider {
    /**
     * Provider name
     * @type {string}
     */
    name = 'base';

    /**
     * Check if provider is configured and available
     * @returns {Promise<boolean>}
     */
    async isAvailable() {
        return false;
    }

    /**
     * Stream audio frames for the given text
     * Yields AudioFrame objects suitable for real-time playback
     * @param {TTSStreamOptions} options
     * @yields {AudioFrame}
     * @returns {AsyncGenerator<AudioFrame>}
     */
    async *stream(options) {
        throw new Error('stream() must be implemented by provider');
    }

    /**
     * Optional: get transcript deltas during synthesis
     * @param {TTSStreamOptions} options
     * @yields {TextDelta}
     * @returns {AsyncGenerator<TextDelta>}
     */
    async *streamTranscript(options) {
        // Default: emit entire text as single final delta
        yield { text: options.text, isFinal: true };
    }
}

/**
 * TTS streaming result with parallel audio and text streams
 * @typedef {Object} TTSStreamResult
 * @property {AsyncGenerator<AudioFrame>} audioStream - Audio frame iterator
 * @property {AsyncGenerator<TextDelta>} transcriptStream - Text delta iterator
 * @property {string} provider - Which provider is being used
 */

export default TTSProvider;
