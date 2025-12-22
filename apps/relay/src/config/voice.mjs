/**
 * Voice Provider Configuration (Pre-wiring for Cartesia)
 * NOTE: No API calls are made in this module, configuration only
 * @module config/voice
 */

/**
 * Voice provider configuration
 * @type {{
 *   provider: string,
 *   cartesia: { apiKey: string | undefined, voiceId: string | undefined },
 *   elevenlabs: { apiKey: string | undefined, agentId: string | undefined }
 * }}
 */
export const voiceConfig = {
    // Current TTS provider (elevenlabs | cartesia)
    provider: process.env.TTS_PROVIDER || 'elevenlabs',

    // Cartesia configuration (future use)
    cartesia: {
        apiKey: process.env.CARTESIA_API_KEY_MVP,
        voiceId: process.env.CARTESIA_VOICE_ID_MVP
    },

    // ElevenLabs configuration
    elevenlabs: {
        apiKey: process.env.ELEVENLABS_API_KEY_MVP || process.env.ELEVENLABS_API_KEY,
        agentId: process.env.ELEVENLABS_AGENT_ID_MVP || process.env.ELEVENLABS_AGENT_ID
    }
};

/**
 * Check if voice provider is configured
 * @returns {boolean}
 */
export function isVoiceConfigured() {
    const { provider, cartesia, elevenlabs } = voiceConfig;

    if (provider === 'cartesia') {
        return !!(cartesia.apiKey && cartesia.voiceId);
    }

    if (provider === 'elevenlabs') {
        return !!(elevenlabs.apiKey && elevenlabs.agentId);
    }

    return false;
}

/**
 * Get current voice provider name (no secrets exposed)
 * @returns {string}
 */
export function getVoiceProviderName() {
    return voiceConfig.provider;
}
