/**
 * TTS Provider Factory
 * Manages provider selection, fallback, and streaming orchestration
 * @module tts/index
 * 
 * Fallback Order (explicit):
 * 1. fishaudio (primary - custom voice)
 * 2. cartesia (1st fallback)
 * 3. elevenlabs (last resort)
 * 4. mock (test/dev only)
 */

import { CartesiaTTSProvider } from './cartesia.mjs';
import { FishAudioTTSProvider } from './fishaudio.mjs';
import { ElevenLabsTTSProvider } from './elevenlabs.mjs';
import { MockTTSProvider } from './mock.mjs';

/**
 * Provider instances (singletons)
 */
const providers = {
    cartesia: new CartesiaTTSProvider(),
    fishaudio: new FishAudioTTSProvider(),
    elevenlabs: new ElevenLabsTTSProvider(),
    mock: new MockTTSProvider()
};

/**
 * Explicit fallback order - this defines the priority chain
 * When a provider fails, we try the next one in this list
 */
const FALLBACK_ORDER = ['fishaudio', 'cartesia', 'elevenlabs'];

/**
 * Get the configured primary provider
 * @returns {string}
 */
function getPrimaryProviderName() {
    return process.env.TTS_PROVIDER || 'fishaudio';
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
 * Get the fallback order starting from a given provider
 * @param {string} startProvider - The provider that failed
 * @returns {string[]} - List of providers to try next
 */
export function getFallbackChain(startProvider) {
    const startIndex = FALLBACK_ORDER.indexOf(startProvider);
    if (startIndex === -1 || startIndex >= FALLBACK_ORDER.length - 1) {
        return [];
    }
    return FALLBACK_ORDER.slice(startIndex + 1);
}

/**
 * Get the active provider with fallback logic
 * Priority: Mock (if enabled) > Configured primary > Fallback chain
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

    // Try fallback chain in order
    for (const providerName of FALLBACK_ORDER) {
        if (providerName === primaryName) continue; // Already tried
        const provider = providers[providerName];
        if (provider && await provider.isAvailable()) {
            console.warn(`[TTS] Primary provider '${primaryName}' unavailable, using '${providerName}'`);
            return provider;
        }
    }

    throw new Error('No TTS provider available. Configure FISH_AUDIO_API_KEY_MVP, CARTESIA_API_KEY_MVP, or ELEVENLABS_API_KEY_MVP');
}

/**
 * Stream TTS with automatic fallback chain
 * If provider fails mid-stream, attempts next provider in chain
 * @param {import('./types.mjs').TTSStreamOptions} options
 * @param {string} [preferredProvider] - Override provider selection
 * @yields {{ type: 'audio', frame: import('./types.mjs').AudioFrame } | { type: 'error', error: Error, switched: boolean }}
 */
export async function* streamWithFallback(options, preferredProvider) {
    const primaryName = preferredProvider || getPrimaryProviderName();

    // Build the provider chain starting from primary
    const providerChain = [primaryName, ...getFallbackChain(primaryName)];

    // If preferred provider is not in standard chain, just use it alone
    if (preferredProvider && !FALLBACK_ORDER.includes(preferredProvider)) {
        providerChain.length = 0;
        providerChain.push(preferredProvider);
    }

    let lastError = null;
    let startProvider = null;

    for (const providerName of providerChain) {
        const provider = providers[providerName];
        if (!provider) continue;

        // Check availability
        if (!await provider.isAvailable()) {
            console.warn(`[TTS] Provider '${providerName}' not available, skipping`);
            continue;
        }

        if (!startProvider) {
            startProvider = providerName;
        } else {
            // This is a fallback, notify
            console.warn(`[TTS] Attempting fallback to '${providerName}'...`);
            yield { type: 'provider_switched', from: startProvider, to: providerName };
        }

        let frameCount = 0;
        try {
            for await (const frame of provider.stream(options)) {
                frameCount++;
                yield { type: 'audio', frame, provider: providerName };
            }
            // Success! Exit the loop
            return;
        } catch (error) {
            console.error(`[TTS] Provider '${providerName}' failed after ${frameCount} frames:`, error.message);
            lastError = error;
            // Continue to next provider in chain
        }
    }

    // All providers failed
    if (lastError) {
        yield { type: 'error', error: lastError, provider: 'all' };
    } else {
        yield { type: 'error', error: new Error('No TTS providers available'), provider: 'none' };
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

    status.fallbackOrder = FALLBACK_ORDER;
    status.activeFallback = process.env.TTS_MOCK_MODE === 'true' ? 'mock' : getPrimaryProviderName();

    return status;
}

/**
 * Export the explicit fallback order for testing
 */
export { FALLBACK_ORDER };

export { CartesiaTTSProvider, FishAudioTTSProvider, ElevenLabsTTSProvider, MockTTSProvider };
