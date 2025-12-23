import React, { useState, type KeyboardEvent } from 'react';

interface PushToTalkProps {
    onSpeak: (text: string) => void;
    status: 'idle' | 'listening' | 'thinking' | 'speaking';
    /** Called when mic button is pressed down */
    onMicStart?: () => void;
    /** Called when mic button is released */
    onMicStop?: () => void;
    /** Whether mic is currently recording */
    isRecording?: boolean;
    /** Whether transcription is in progress */
    isTranscribing?: boolean;
    /** Mic recorder error message */
    micError?: string | null;
}

const PushToTalk: React.FC<PushToTalkProps> = ({
    onSpeak,
    status,
    onMicStart,
    onMicStop,
    isRecording = false,
    isTranscribing = false,
    micError
}) => {
    const [inputText, setInputText] = useState('');

    const handleMouseDown = () => {
        if (status === 'idle' && onMicStart) {
            onMicStart();
        }
    };

    const handleMouseUp = () => {
        if (isRecording && onMicStop) {
            onMicStop();
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && inputText.trim() && status === 'idle') {
            onSpeak(inputText);
            setInputText('');
        }
    };

    // Determine mic button state class
    const getMicButtonClass = () => {
        if (isRecording) return 'active recording';
        if (isTranscribing) return 'active transcribing';
        return '';
    };

    // Determine mic icon based on state
    const getMicIcon = () => {
        if (isRecording) return '●';
        if (isTranscribing) return '...';
        return '●';
    };

    return (
        <div className="input-container">
            <div
                className={`mic-button ${getMicButtonClass()}`}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => isRecording && onMicStop?.()}
                onTouchStart={handleMouseDown}
                onTouchEnd={handleMouseUp}
            >
                <div className="mic-icon">{getMicIcon()}</div>
            </div>

            {micError && (
                <div style={{ color: 'var(--hud-red)', fontSize: '0.7rem', marginTop: '0.5rem' }}>
                    {micError}
                </div>
            )}

            <div style={{ marginTop: '2rem', width: '100%' }}>
                <input
                    type="text"
                    className="hud-input"
                    placeholder={
                        isRecording ? "LISTENING..." :
                            isTranscribing ? "TRANSCRIBING..." :
                                status === 'idle' ? "SAY SOMETHING OR TYPE HERE..." :
                                    "JARVIS IS PROCESSING..."
                    }
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={status !== 'idle' || isRecording || isTranscribing}
                />
                <div style={{ fontSize: '0.6rem', color: 'rgba(0, 242, 255, 0.5)', marginTop: '0.5rem', textAlign: 'center' }}>
                    PRESS ENTER TO TRANSMIT • HOLD MIC FOR VOICE INPUT
                </div>
            </div>
        </div>
    );
};

export default PushToTalk;

