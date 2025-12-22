/**
 * Voice Provider Configuration
 * TTS provider settings for Cartesia (primary) and ElevenLabs (fallback)
 * @module config/voice
 */

/**
 * Voice provider configuration
 * @type {{
 *   provider: string,
 *   cartesia: { apiKey: string | undefined, voiceId: string | undefined },
 *   elevenlabs: { apiKey: string | undefined, voiceId: string | undefined }
 * }}
 */
export const voiceConfig = {
    // Current TTS provider (cartesia | elevenlabs)
    // Cartesia is primary, ElevenLabs is fallback
    provider: process.env.TTS_PROVIDER || 'cartesia',

    // Cartesia configuration (primary)
    cartesia: {
        apiKey: process.env.CARTESIA_API_KEY_MVP,
        voiceId: process.env.CARTESIA_VOICE_ID_MVP
    },

    // ElevenLabs configuration (fallback)
    // Uses TTS endpoint with voice_id, NOT Agents Platform
    elevenlabs: {
        apiKey: process.env.ELEVENLABS_API_KEY_MVP || process.env.ELEVENLABS_API_KEY,
        voiceId: process.env.ELEVENLABS_VOICE_ID_MVP || 'EXAVITQu4vr4xnSDxMaL' // Default: Bella
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
        return !!(elevenlabs.apiKey && elevenlabs.voiceId);
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

