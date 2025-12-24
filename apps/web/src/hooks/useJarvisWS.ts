import { useState, useCallback, useEffect, useRef } from 'react';
import { CONFIG } from '../config';

export type WSState = 'idle' | 'connecting' | 'connected' | 'bound' | 'error';

export interface AudioFrame {
    data_b64: string;
    codec: string;
    seq: number;
}

/**
 * WebSocket hook for JARVIS voice streaming
 * Contract-compliant implementation with required logging
 */
export function useJarvisWS(userId: string | null, sessionId: string | null) {
    const [state, setState] = useState<WSState>('idle');
    const [transcript, setTranscript] = useState<string>('');
    const [lastProvider, setLastProvider] = useState<string | null>(null);
    const [streamInfo, setStreamInfo] = useState<{ codec?: string, sample_rate?: number } | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const onAudioFrameRef = useRef<((frame: AudioFrame) => void) | null>(null);
    const onAudioEndRef = useRef<((provider: string) => void) | null>(null);
    const frameCountRef = useRef<number>(0);
    const connectingRef = useRef<boolean>(false);
    const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Ping interval: 30 seconds (well under Cloud Run's 60s timeout)
    const PING_INTERVAL_MS = 30000;

    /**
     * Connect to WebSocket and bind session
     * Contract: Connect to WS_URL, on 'connected' send session.bind
     */
    const connect = useCallback(() => {
        if (!userId || !sessionId) {
            console.log('[ws] Cannot connect: missing userId or sessionId');
            return;
        }

        // Prevent multiple simultaneous connection attempts
        if (wsRef.current?.readyState === WebSocket.OPEN ||
            wsRef.current?.readyState === WebSocket.CONNECTING ||
            connectingRef.current) {
            console.log('[ws] Already connected or connecting, skipping');
            return;
        }

        connectingRef.current = true;
        console.log('[ws] Connecting to', CONFIG.WS_URL);
        setState('connecting');

        const ws = new WebSocket(CONFIG.WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log('[ws] WebSocket opened');
            setState('connected');
            connectingRef.current = false;
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);

                switch (msg.type) {
                    case 'connected':
                        // On 'connected', send session.bind
                        console.log('[ws] Received connected, sending session.bind');
                        ws.send(JSON.stringify({
                            type: 'session.bind',
                            user_id: userId,
                            session_id: sessionId
                        }));
                        break;

                    case 'session.bound':
                        // Contract log: [ws] bound user_id=<...> session_id=<...>
                        console.log(`[ws] bound user_id=${userId} session_id=${sessionId}`);
                        setState('bound');
                        // Start ping keepalive to prevent Cloud Run idle timeout
                        if (pingIntervalRef.current) {
                            clearInterval(pingIntervalRef.current);
                        }
                        pingIntervalRef.current = setInterval(() => {
                            if (ws.readyState === WebSocket.OPEN) {
                                ws.send(JSON.stringify({ type: 'ping' }));
                                console.log('[ws] ping sent');
                            }
                        }, PING_INTERVAL_MS);
                        break;

                    case 'transcript.delta':
                        setTranscript(prev => prev + (msg.text || ''));
                        break;

                    case 'audio.frame':
                        // Don't call setStreamInfo here - it triggers re-render on every frame
                        // which can cause WS instability. Store in ref instead.
                        frameCountRef.current++;

                        // Contract log: Log every 25 frames
                        if (frameCountRef.current % 25 === 0 || frameCountRef.current === 1) {
                            console.log(`[audio] received seq=${msg.seq}`);
                        }

                        if (onAudioFrameRef.current) {
                            onAudioFrameRef.current({
                                data_b64: msg.data_b64,
                                codec: msg.codec,
                                seq: msg.seq
                            });
                        }
                        break;

                    case 'audio.end':
                        // Set stream info now that stream is complete (not during frame processing)
                        setStreamInfo({ codec: msg.codec, sample_rate: msg.sample_rate_hz });

                        // Contract log: [audio] playing codec=... provider=...
                        console.log(`[audio] playing codec=${msg.codec || 'unknown'} provider=${msg.provider}`);
                        console.log(`[audio] stream ended, total frames: ${frameCountRef.current}`);

                        setLastProvider(msg.provider);
                        frameCountRef.current = 0;

                        if (onAudioEndRef.current) {
                            onAudioEndRef.current(msg.provider);
                        }
                        break;

                    case 'provider.switched':
                        console.log(`[ws] Provider switched from ${msg.from} to ${msg.to}`);
                        break;

                    case 'pong':
                        console.log('[ws] pong received');
                        break;

                    case 'error':
                        console.error('[ws] Relay Error:', msg.code, msg.message);
                        break;

                    default:
                        console.log('[ws] Unknown message type:', msg.type);
                }
            } catch (err) {
                console.error('[ws] Parse error:', err);
            }
        };

        ws.onclose = (event) => {
            console.log('[ws] Disconnected, code:', event.code);
            setState('idle');
            wsRef.current = null;
            connectingRef.current = false;
            // Clear ping interval on disconnect
            if (pingIntervalRef.current) {
                clearInterval(pingIntervalRef.current);
                pingIntervalRef.current = null;
            }
        };

        ws.onerror = (err) => {
            console.error('[ws] WebSocket Error:', err);
            setState('error');
            connectingRef.current = false;
        };
    }, [userId, sessionId]); // Removed streamInfo?.codec dependency

    // Auto-connect when userId and sessionId are available
    // IMPORTANT: Do NOT include 'connect' in deps - it causes reconnection loops
    // when any state changes. We use a ref to call connect stably.
    const connectRef = useRef(connect);
    connectRef.current = connect;

    useEffect(() => {
        if (userId && sessionId) {
            connectRef.current();
        }
        return () => {
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
            // Clean up ping interval on unmount
            if (pingIntervalRef.current) {
                clearInterval(pingIntervalRef.current);
                pingIntervalRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, sessionId]);

    /**
     * Send assistant.speak message to trigger TTS
     * Contract: WS send assistant.speak with assistant_text
     */
    const speak = useCallback((text: string) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            setTranscript(''); // Clear for new response
            setLastProvider(null);
            frameCountRef.current = 0;

            // Contract log: [ws] assistant.speak sent
            console.log('[ws] assistant.speak sent, text_length=' + text.length);

            wsRef.current.send(JSON.stringify({
                type: 'assistant.speak',
                text
            }));
        } else {
            console.error('[ws] Cannot speak: WebSocket not open, state:', wsRef.current?.readyState);
        }
    }, []);

    /**
     * Full respond flow:
     * A) POST /assistant/respond
     * B) Receive assistant_text
     * C) WS send assistant.speak
     */
    const ask = useCallback(async (userText: string) => {
        if (!userId || !sessionId) {
            console.error('[respond] Cannot ask: missing userId or sessionId');
            return;
        }

        // Contract log: [respond] user_text="..."
        console.log(`[respond] user_text="${userText}"`);

        const response = await fetch(`${CONFIG.API_BASE_URL}/assistant/respond`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                [CONFIG.USER_ID_HEADER]: userId
            },
            body: JSON.stringify({
                session_id: sessionId,
                user_text: userText
            })
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('[respond] API error:', error);
            throw new Error(error.message || `HTTP ${response.status}`);
        }

        const data = await response.json();

        // Contract log: [respond] assistant_text_len=...
        console.log(`[respond] assistant_text_len=${data.response_text?.length || 0}, provider=${data.provider}`);

        speak(data.response_text);
        return data;
    }, [userId, sessionId, speak]);

    const setAudioHandlers = useCallback((onFrame: (f: AudioFrame) => void, onEnd: (p: string) => void) => {
        onAudioFrameRef.current = onFrame;
        onAudioEndRef.current = onEnd;
    }, []);

    return {
        state,
        transcript,
        lastProvider,
        streamInfo,
        ask,
        speak,
        setAudioHandlers
    };
}
