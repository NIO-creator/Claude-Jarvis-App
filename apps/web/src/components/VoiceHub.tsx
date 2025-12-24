import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from '../hooks/useSession';
import { useJarvisWS } from '../hooks/useJarvisWS';
import { useAudioStream } from '../hooks/useAudioStream';
import { useMicRecorder } from '../hooks/useMicRecorder';
import { CONFIG } from '../config';
import StatusRing from './StatusRing';
import PushToTalk from './PushToTalk';
import TranscriptPanel from './TranscriptPanel';
import TestRoutingPanel from './TestRoutingPanel';

/**
 * Config Error Display Component
 * Shown when required environment variables are missing
 */
const ConfigError: React.FC = () => (
    <div className="hud-container">
        <div className="hud-panel" style={{ textAlign: 'center' }}>
            <div className="hub-header">
                <div className="hub-title">JARVIS SYSTEM v1.0</div>
                <div className="status-indicator error">CONFIG ERROR</div>
            </div>
            <div style={{
                color: 'var(--hud-red, #ff3366)',
                fontSize: '0.9rem',
                padding: '2rem',
                fontFamily: 'monospace'
            }}>
                <p style={{ marginBottom: '1rem' }}>⚠️ Configuration Error</p>
                {CONFIG.errors.map((error, i) => (
                    <p key={i} style={{ marginBottom: '0.5rem', opacity: 0.8 }}>{error}</p>
                ))}
                <p style={{ marginTop: '2rem', fontSize: '0.7rem', color: 'rgba(0,242,255,0.6)' }}>
                    Rebuild with required environment variables
                </p>
            </div>
        </div>
    </div>
);

/**
 * VoiceHub - Main component for JARVIS voice interface
 * Implements the end-to-end loop:
 * Mic → STT → POST /assistant/respond → WS assistant.speak → streamed audio + transcript
 */
const VoiceHub: React.FC = () => {
    // All hooks must be called unconditionally (React rules of hooks)
    const { userId, session, loading, error: sessionError, startSession, resetSession } = useSession();
    const {
        state: wsState,
        transcript: assistantText,
        lastProvider,
        streamInfo,
        llmInfo,
        ask,
        setAudioHandlers
    } = useJarvisWS(userId, session?.session_id || null);
    const { feedFrame, endStream, isPlaying, initAudioContext } = useAudioStream();
    const {
        isRecording,
        isTranscribing,
        error: micError,
        startRecording,
        stopRecording
    } = useMicRecorder();

    const [userTranscript, setUserTranscript] = useState('');

    // Derive internal status from hook states (useMemo instead of setState in effect)
    const internalStatus = React.useMemo((): 'idle' | 'listening' | 'thinking' | 'speaking' => {
        if (isRecording) return 'listening';
        if (isTranscribing || wsState === 'connecting') return 'thinking';
        if (isPlaying) return 'speaking';
        return 'idle';
    }, [isRecording, isTranscribing, isPlaying, wsState]);

    // Connect audio handlers
    useEffect(() => {
        setAudioHandlers(
            (frame) => feedFrame(frame.data_b64, frame.codec),
            () => endStream()
        );
    }, [setAudioHandlers, feedFrame, endStream]);

    // Initial session start on load
    useEffect(() => {
        if (userId && !session && !loading) {
            console.log('[VoiceHub] Starting initial session');
            startSession().catch(err => {
                console.error('[VoiceHub] Failed to start session:', err);
            });
        }
    }, [userId, session, loading, startSession]);

    /**
     * Handle user speech/text input
     * Triggers the full respond flow
     */
    const handleSpeak = useCallback(async (text: string) => {
        initAudioContext(); // Ensure AudioContext is resumed on user action
        setUserTranscript(text);
        // Status automatically updates to 'thinking' via derived state when wsState changes

        try {
            await ask(text);
        } catch (err) {
            console.error('[VoiceHub] Failed to get response:', err);
            // Status automatically returns to 'idle' via derived state
        }
    }, [ask, initAudioContext]);

    /**
     * Handle mic start (push-to-talk pressed)
     */
    const handleMicStart = useCallback(() => {
        console.log('[VoiceHub] Mic start');
        initAudioContext(); // Resume AudioContext on user gesture
        startRecording();
    }, [startRecording, initAudioContext]);

    /**
     * Handle mic stop (push-to-talk released)
     * Gets transcript from STT and triggers respond flow
     */
    const handleMicStop = useCallback(async () => {
        console.log('[VoiceHub] Mic stop, transcribing...');
        const transcript = await stopRecording();

        if (transcript) {
            console.log('[VoiceHub] Got transcript:', transcript);
            handleSpeak(transcript);
        } else {
            console.log('[VoiceHub] No transcript returned');
            // Status automatically returns to 'idle' via derived state
        }
    }, [stopRecording, handleSpeak]);

    // Determine connection status text
    const getStatusText = () => {
        if (sessionError) return 'SESSION ERROR';
        if (loading) return 'STARTING...';
        switch (wsState) {
            case 'idle': return 'DISCONNECTED';
            case 'connecting': return 'CONNECTING...';
            case 'connected': return 'BINDING...';
            case 'bound': return 'ONLINE';
            case 'error': return 'WS ERROR';
        }
    };

    const statusClass = sessionError || wsState === 'error' ? 'error' : wsState;

    // Check for config errors after all hooks are called
    if (!CONFIG.isValid) {
        return <ConfigError />;
    }

    return (
        <div className="hud-container">
            <div className="hud-panel">
                <div className="hub-header">
                    <div className="hub-title">JARVIS SYSTEM v1.0</div>
                    <div className={`status-indicator ${statusClass}`}>
                        {getStatusText()}
                    </div>
                </div>

                {sessionError && (
                    <div style={{ color: 'var(--hud-red)', fontSize: '0.8rem', marginBottom: '1rem' }}>
                        Error: {sessionError}
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div className="status-ring-container">
                        <StatusRing status={internalStatus} />
                        <PushToTalk
                            onSpeak={handleSpeak}
                            status={internalStatus}
                            onMicStart={handleMicStart}
                            onMicStop={handleMicStop}
                            isRecording={isRecording}
                            isTranscribing={isTranscribing}
                            micError={micError}
                        />
                    </div>

                    <TranscriptPanel
                        transcript={userTranscript}
                        assistantText={assistantText}
                        provider={lastProvider}
                        streamInfo={streamInfo}
                        llmInfo={llmInfo}
                    />
                </div>

                <div className="controls">
                    <button
                        className="hud-button"
                        onClick={() => resetSession()}
                        disabled={loading}
                    >
                        NEW SESSION
                    </button>
                    <button
                        className="hud-button red"
                        onClick={() => window.location.reload()}
                    >
                        REBOOT HUD
                    </button>
                </div>
            </div>

            <div style={{
                position: 'fixed',
                bottom: '1rem',
                right: '1rem',
                fontSize: '0.6rem',
                opacity: 0.5,
                fontFamily: 'monospace'
            }}>
                USER: {userId?.substring(0, 8)}... | SESSION: {session?.session_id?.substring(0, 8)}... | WS: {wsState}
            </div>

            {/* Test Routing Panel */}
            <TestRoutingPanel />
        </div>
    );
};

export default VoiceHub;

