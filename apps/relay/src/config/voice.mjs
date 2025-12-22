/**
 * Voice Provider Configuration
 * TTS provider settings for Fish Audio (primary) and ElevenLabs (fallback)
 * @module config/voice
 */

/**
 * Voice provider configuration
 * @type {{
 *   provider: string,
 *   fishaudio: { apiKey: string | undefined, voiceId: string | undefined },
 *   elevenlabs: { apiKey: string | undefined, voiceId: string | undefined }
 * }}
 */
export const voiceConfig = {
    // Current TTS provider (fishaudio | elevenlabs)
    // Fish Audio is primary, ElevenLabs is fallback
    provider: process.env.TTS_PROVIDER || 'fishaudio',

    // Fish Audio configuration (primary)
    fishaudio: {
        apiKey: process.env.FISH_AUDIO_API_KEY_MVP,
        voiceId: process.env.FISH_AUDIO_VOICE_ID_MVP
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
    const { provider, fishaudio, elevenlabs } = voiceConfig;

    if (provider === 'fishaudio') {
        return !!(fishaudio.apiKey && fishaudio.voiceId);
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
