import React, { useState, useEffect } from 'react';

// Storage keys for persistence
const STORAGE_KEYS = {
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

interface TestRoutingPanelProps {
    onModeChange?: () => void;
}

const TestRoutingPanel: React.FC<TestRoutingPanelProps> = ({ onModeChange }) => {
    const [expanded, setExpanded] = useState(false);
    const [llmMode, setLLMMode] = useState<LLMMode>(getLLMMode);
    const [ttsMode, setTTSMode] = useState<TTSMode>(getTTSMode);

    // Save LLM mode to localStorage
    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.LLM_MODE, llmMode);
        console.log('[TestRouting] LLM mode changed:', llmMode);
        onModeChange?.();
    }, [llmMode, onModeChange]);

    // Save TTS mode to localStorage
    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.TTS_MODE, ttsMode);
        console.log('[TestRouting] TTS mode changed:', ttsMode, 'tts_disable:', getTTSDisable());
        onModeChange?.();
    }, [ttsMode, onModeChange]);

    const panelStyle: React.CSSProperties = {
        position: 'fixed',
        top: '1rem',
        left: '1rem',
        background: 'rgba(0, 10, 20, 0.95)',
        border: '1px solid rgba(0, 242, 255, 0.3)',
        borderRadius: '4px',
        padding: expanded ? '1rem' : '0.5rem',
        fontFamily: 'monospace',
        fontSize: '0.75rem',
        color: 'var(--hud-text, #00f2ff)',
        zIndex: 1000,
        minWidth: expanded ? '200px' : 'auto',
    };

    const headerStyle: React.CSSProperties = {
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        opacity: 0.8,
    };

    const selectStyle: React.CSSProperties = {
        background: 'rgba(0, 20, 40, 0.9)',
        border: '1px solid rgba(0, 242, 255, 0.4)',
        color: 'var(--hud-text, #00f2ff)',
        padding: '0.3rem 0.5rem',
        fontSize: '0.7rem',
        borderRadius: '2px',
        width: '100%',
        marginTop: '0.3rem',
    };

    const labelStyle: React.CSSProperties = {
        display: 'block',
        marginTop: '0.8rem',
        opacity: 0.7,
        fontSize: '0.65rem',
    };

    return (
        <div style={panelStyle}>
            <div style={headerStyle} onClick={() => setExpanded(!expanded)}>
                {expanded ? '▼' : '►'} TEST ROUTING
            </div>

            {expanded && (
                <div style={{ marginTop: '0.5rem' }}>
                    <label style={labelStyle}>LLM Provider</label>
                    <select
                        style={selectStyle}
                        value={llmMode}
                        onChange={(e) => setLLMMode(e.target.value as LLMMode)}
                    >
                        <option value="default">Default (auto)</option>
                        <option value="openai">Force OpenAI</option>
                        <option value="gemini">Force Gemini</option>
                    </select>

                    <label style={labelStyle}>TTS Provider</label>
                    <select
                        style={selectStyle}
                        value={ttsMode}
                        onChange={(e) => setTTSMode(e.target.value as TTSMode)}
                    >
                        <option value="default">Default chain (Fish→Cart→11L)</option>
                        <option value="force_fish">Force FishAudio</option>
                        <option value="force_cartesia">Force Cartesia</option>
                        <option value="force_elevenlabs">Force ElevenLabs</option>
                        <option value="disable_fish">Disable FishAudio</option>
                        <option value="disable_fish_cartesia">Disable Fish+Cartesia</option>
                    </select>

                    <div style={{ marginTop: '1rem', opacity: 0.5, fontSize: '0.6rem' }}>
                        Changes apply to next request
                    </div>
                </div>
            )}
        </div>
    );
};

export default TestRoutingPanel;
