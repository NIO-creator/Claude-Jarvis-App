/**
 * TTS Provider Factory
 * Manages provider selection, fallback, and streaming orchestration
 * @module tts/index
 */

import { CartesiaTTSProvider } from './cartesia.mjs';
import { ElevenLabsTTSProvider } from './elevenlabs.mjs';
import { MockTTSProvider } from './mock.mjs';

/**
 * Provider instances (singletons)
 */
const providers = {
    cartesia: new CartesiaTTSProvider(),
    elevenlabs: new ElevenLabsTTSProvider(),
    mock: new MockTTSProvider()
};

/**
 * Get the configured primary provider
 * @returns {string}
 */
function getPrimaryProviderName() {
    return process.env.TTS_PROVIDER || 'cartesia';
}

/**
 * Get a provider by name
 * @param {string} name
 * @returns {import('./types.mjs').TTSProvider | null}
 */
export function getProvider(name) {
    return providers[name] || null;
}

/**
 * Get the active provider with fallback logic
 * Priority: Mock (if enabled) > Configured primary > ElevenLabs fallback
 * @returns {Promise<import('./types.mjs').TTSProvider>}
 */
export async function getActiveProvider() {
    // Mock mode takes priority for testing
    if (await providers.mock.isAvailable()) {
        return providers.mock;
    }

    const primaryName = getPrimaryProviderName();
    const primary = providers[primaryName];

    if (primary && await primary.isAvailable()) {
        return primary;
    }

    // Fallback to ElevenLabs
    if (await providers.elevenlabs.isAvailable()) {
        console.warn(`[TTS] Primary provider '${primaryName}' unavailable, falling back to ElevenLabs`);
        return providers.elevenlabs;
    }

    throw new Error('No TTS provider available. Configure CARTESIA_API_KEY_MVP or ELEVENLABS_API_KEY_MVP');
}

/**
 * Stream TTS with automatic fallback
 * If primary provider fails mid-stream, attempts to continue with fallback
 * @param {import('./types.mjs').TTSStreamOptions} options
 * @param {string} [preferredProvider] - Override provider selection
 * @yields {{ type: 'audio', frame: import('./types.mjs').AudioFrame } | { type: 'error', error: Error, switched: boolean }}
 */
export async function* streamWithFallback(options, preferredProvider) {
    const providerName = preferredProvider || getPrimaryProviderName();
    let currentProvider = await getActiveProvider();

    // If specific provider requested and available, use it
    if (preferredProvider && providers[preferredProvider]) {
        const requested = providers[preferredProvider];
        if (await requested.isAvailable()) {
            currentProvider = requested;
        }
    }

    const startProvider = currentProvider.name;
    let frameCount = 0;
    let usedFallback = false;

    try {
        for await (const frame of currentProvider.stream(options)) {
            frameCount++;
            yield { type: 'audio', frame, provider: currentProvider.name };
        }
    } catch (error) {
        console.error(`[TTS] Provider '${currentProvider.name}' failed after ${frameCount} frames:`, error.message);

        // Attempt fallback if we haven't already
        if (currentProvider.name !== 'elevenlabs' && !usedFallback) {
            if (await providers.elevenlabs.isAvailable()) {
                console.warn(`[TTS] Attempting fallback to ElevenLabs...`);
                usedFallback = true;
                currentProvider = providers.elevenlabs;

                try {
                    // Restart from beginning with fallback provider
                    for await (const frame of currentProvider.stream(options)) {
                        yield { type: 'audio', frame, provider: currentProvider.name };
                    }
                    // Successfully completed with fallback
                    yield { type: 'provider_switched', from: startProvider, to: 'elevenlabs' };
                    return;
                } catch (fallbackError) {
                    console.error('[TTS] Fallback provider also failed:', fallbackError.message);
                    yield { type: 'error', error: fallbackError, provider: 'elevenlabs' };
                }
            }
        }

        yield { type: 'error', error, provider: currentProvider.name };
    }
}

/**
 * Get provider status for health checks
 * @returns {Promise<Object>}
 */
export async function getProviderStatus() {
    const status = {};

    for (const [name, provider] of Object.entries(providers)) {
        status[name] = {
            available: await provider.isAvailable(),
            isPrimary: name === getPrimaryProviderName()
        };
    }

    status.activeFallback = process.env.TTS_MOCK_MODE === 'true' ? 'mock' : getPrimaryProviderName();

    return status;
}

export { CartesiaTTSProvider, ElevenLabsTTSProvider, MockTTSProvider };
