/**
 * JARVIS Web Client Configuration
 * Single source of truth for API and WebSocket endpoints
 * Fails fast if required environment variables are missing
 */

// Validate required environment variables
const API_BASE_URL = import.meta.env.VITE_API_URL;
const WS_URL = import.meta.env.VITE_RELAY_URL;

if (!API_BASE_URL) {
    throw new Error(
        '[config] VITE_API_URL is not set. ' +
        'Create a .env file with VITE_API_URL=http://localhost:8080 or set the environment variable.'
    );
}

if (!WS_URL) {
    throw new Error(
        '[config] VITE_RELAY_URL is not set. ' +
        'Create a .env file with VITE_RELAY_URL=ws://localhost:8080/ws or set the environment variable.'
    );
}

export const CONFIG = {
    API_BASE_URL,
    WS_URL,
    USER_ID_HEADER: 'x-jarvis-user-id',
    STORAGE_KEY_USER_ID: 'jarvis_user_id',
} as const;

console.log('[config] Loaded:', {
    API_BASE_URL: CONFIG.API_BASE_URL,
    WS_URL: CONFIG.WS_URL,
});
