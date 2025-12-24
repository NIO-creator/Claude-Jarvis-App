/**
 * JARVIS Web Client Configuration
 * Single source of truth for API and WebSocket endpoints
 * Validates but does NOT throw - displays error UI instead
 */

// Validate required environment variables
const API_BASE_URL = import.meta.env.VITE_API_URL;
const WS_URL = import.meta.env.VITE_RELAY_URL;

// Track configuration errors instead of throwing
const configErrors: string[] = [];

if (!API_BASE_URL) {
    configErrors.push('[config] VITE_API_URL is not set. Build with --build-arg VITE_API_URL=https://your-api-url');
    console.error('[config] FATAL: VITE_API_URL is not set');
}

if (!WS_URL) {
    configErrors.push('[config] VITE_RELAY_URL is not set. Build with --build-arg VITE_RELAY_URL=wss://your-ws-url/ws');
    console.error('[config] FATAL: VITE_RELAY_URL is not set');
}

export const CONFIG = {
    API_BASE_URL: API_BASE_URL || '',
    WS_URL: WS_URL || '',
    USER_ID_HEADER: 'x-jarvis-user-id',
    STORAGE_KEY_USER_ID: 'jarvis_user_id',
    errors: configErrors,
    isValid: configErrors.length === 0,
} as const;

if (CONFIG.isValid) {
    console.log('[config] Loaded:', {
        API_BASE_URL: CONFIG.API_BASE_URL,
        WS_URL: CONFIG.WS_URL,
    });
} else {
    console.error('[config] Configuration errors:', CONFIG.errors);
}

