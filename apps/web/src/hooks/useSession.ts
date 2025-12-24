import { CONFIG } from '../config';
import { useState, useCallback } from 'react';

export interface Session {
    session_id: string;
    started_at: string;
    bootstrap_context: Record<string, unknown>;
}

/**
 * Get or create user ID from localStorage
 * Contract: Generate UUID once and store in localStorage with key: jarvis_user_id
 */
const getUserId = (): string => {
    let id = localStorage.getItem(CONFIG.STORAGE_KEY_USER_ID);
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(CONFIG.STORAGE_KEY_USER_ID, id);
        console.log('[session] Generated new user_id:', id);
    }
    return id;
};

export function useSession() {
    const [userId] = useState(getUserId());
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * POST /session/start
     * Contract: On app load, POST with header x-jarvis-user-id
     */
    const startSession = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            console.log('[session] Starting session for user_id:', userId);

            const response = await fetch(`${CONFIG.API_BASE_URL}/session/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    [CONFIG.USER_ID_HEADER]: userId,
                },
                body: JSON.stringify({
                    persona_id: 'jarvis'
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || `HTTP ${response.status}`);
            }

            const data = await response.json();
            setSession(data);

            // Contract log: [session] started session_id=<...>
            console.log('[session] started session_id=' + data.session_id);

            return data;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Session start failed';
            setError(message);
            console.error('[session] Start error:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [userId]);

    /**
     * POST /session/end
     * Contract: End current session
     */
    const endSession = useCallback(async () => {
        if (!session) return;
        try {
            console.log('[session] Ending session_id:', session.session_id);

            await fetch(`${CONFIG.API_BASE_URL}/session/end`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    [CONFIG.USER_ID_HEADER]: userId,
                },
                body: JSON.stringify({ session_id: session.session_id }),
            });

            console.log('[session] ended session_id=' + session.session_id);
            setSession(null);
        } catch (err) {
            console.error('[session] End error:', err);
        }
    }, [userId, session]);

    const resetSession = useCallback(async () => {
        await endSession();
        return startSession();
    }, [endSession, startSession]);

    return {
        userId,
        session,
        loading,
        error,
        startSession,
        endSession,
        resetSession,
    };
}
