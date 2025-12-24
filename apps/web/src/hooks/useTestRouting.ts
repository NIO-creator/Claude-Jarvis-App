// Test Routing Storage and Helpers
// Separated from component to avoid react-refresh/only-export-components lint error

// Storage keys for persistence
export const STORAGE_KEYS = {
    LLM_MODE: 'jarvis_test_llm_mode',
    TTS_MODE: 'jarvis_test_tts_mode',
};

// Type definitions
export type LLMMode = 'default' | 'openai' | 'gemini';
export type TTSMode = 'default' | 'force_fish' | 'force_cartesia' | 'force_elevenlabs' | 'disable_fish' | 'disable_fish_cartesia';

// Get current LLM mode from localStorage
export const getLLMMode = (): LLMMode => {
    return (localStorage.getItem(STORAGE_KEYS.LLM_MODE) as LLMMode) || 'default';
};

// Get LLM header value (or null if default)
export const getLLMHeader = (): string | null => {
    const mode = getLLMMode();
    if (mode === 'openai') return 'openai';
    if (mode === 'gemini') return 'gemini';
    return null;
};

// Get current TTS mode from localStorage
export const getTTSMode = (): TTSMode => {
    return (localStorage.getItem(STORAGE_KEYS.TTS_MODE) as TTSMode) || 'default';
};

// Get tts_disable array based on mode
export const getTTSDisable = (): string[] => {
    const mode = getTTSMode();
    switch (mode) {
        case 'disable_fish':
            return ['fishaudio'];
        case 'disable_fish_cartesia':
            return ['fishaudio', 'cartesia'];
        case 'force_cartesia':
            return ['fishaudio']; // Disable fish to force cartesia
        case 'force_elevenlabs':
            return ['fishaudio', 'cartesia']; // Disable both to force elevenlabs
        case 'force_fish':
        case 'default':
        default:
            return [];
    }
};

// Set LLM mode in localStorage
export const setLLMMode = (mode: LLMMode): void => {
    localStorage.setItem(STORAGE_KEYS.LLM_MODE, mode);
};

// Set TTS mode in localStorage
export const setTTSMode = (mode: TTSMode): void => {
    localStorage.setItem(STORAGE_KEYS.TTS_MODE, mode);
};
