#!/usr/bin/env node
/**
 * TTS Provider Diagnostic Script
 * Tests each provider's availability and streaming capability
 * 
 * Usage:
 *   node scripts/diagnose-tts.mjs
 *   
 * Environment variables required per provider:
 *   CARTESIA_API_KEY_MVP, CARTESIA_VOICE_ID_MVP
 *   FISH_AUDIO_API_KEY_MVP, FISH_AUDIO_VOICE_ID_MVP
 *   ELEVENLABS_API_KEY_MVP, ELEVENLABS_VOICE_ID_MVP
 */

import { getProviderStatus, getProvider, streamWithFallback } from '../src/tts/index.mjs';

const TEST_TEXT = 'Hello, this is a test of the voice provider.';
const TIMEOUT_MS = 15000;

async function diagnoseProvider(name) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`PROVIDER: ${name.toUpperCase()}`);
    console.log('='.repeat(50));

    const provider = getProvider(name);
    if (!provider) {
        console.log(`❌ Provider '${name}' not found in registry`);
        return { name, success: false, error: 'Not found' };
    }

    const available = await provider.isAvailable();
    console.log(`Available: ${available ? '✅ Yes' : '❌ No (missing credentials)'}`);

    if (!available) {
        return { name, success: false, error: 'Not configured' };
    }

    // Try streaming
    console.log(`Testing stream with text: "${TEST_TEXT.slice(0, 30)}..."`);

    const startTime = Date.now();
    let frameCount = 0;
    let totalBytes = 0;
    let lastCodec = null;
    let error = null;

    try {
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS)
        );

        const streamPromise = (async () => {
            for await (const frame of provider.stream({ text: TEST_TEXT })) {
                frameCount++;
                totalBytes += frame.data.length;
                lastCodec = frame.codec;
                if (frameCount === 1) {
                    console.log(`  First frame received (${frame.data.length} bytes, codec: ${frame.codec})`);
                }
            }
        })();

        await Promise.race([streamPromise, timeoutPromise]);

    } catch (err) {
        error = err.message;
        console.log(`❌ Stream error: ${error}`);
    }

    const duration = Date.now() - startTime;

    if (frameCount > 0) {
        console.log(`✅ Stream complete:`);
        console.log(`   Frames: ${frameCount}`);
        console.log(`   Total bytes: ${totalBytes}`);
        console.log(`   Codec: ${lastCodec}`);
        console.log(`   Duration: ${duration}ms`);
        return { name, success: true, frameCount, totalBytes, codec: lastCodec, duration };
    }

    return { name, success: false, error: error || 'No frames received' };
}

async function main() {
    console.log('TTS Provider Diagnostics');
    console.log('========================\n');

    // Get current status
    const status = await getProviderStatus();
    console.log('Provider Status:');
    for (const [name, info] of Object.entries(status)) {
        if (name === 'activeFallback') continue;
        console.log(`  ${name}: ${info.available ? '✅' : '❌'} ${info.isPrimary ? '(PRIMARY)' : ''}`);
    }
    console.log(`  Active Fallback: ${status.activeFallback}`);

    // Test each provider
    const results = [];

    for (const name of ['cartesia', 'fishaudio', 'elevenlabs', 'mock']) {
        // Skip mock unless explicitly testing
        if (name === 'mock' && process.env.TTS_MOCK_MODE !== 'true') {
            console.log(`\nSkipping mock provider (TTS_MOCK_MODE not set)`);
            continue;
        }

        try {
            const result = await diagnoseProvider(name);
            results.push(result);
        } catch (err) {
            console.log(`❌ Unexpected error testing ${name}: ${err.message}`);
            results.push({ name, success: false, error: err.message });
        }
    }

    // Summary
    console.log(`\n${'='.repeat(50)}`);
    console.log('SUMMARY');
    console.log('='.repeat(50));

    const working = results.filter(r => r.success);
    const failing = results.filter(r => !r.success);

    if (working.length > 0) {
        console.log(`\n✅ Working providers (${working.length}):`);
        working.forEach(r => console.log(`   ${r.name}: ${r.frameCount} frames, ${r.totalBytes} bytes`));
    }

    if (failing.length > 0) {
        console.log(`\n❌ Failing providers (${failing.length}):`);
        failing.forEach(r => console.log(`   ${r.name}: ${r.error}`));
    }

    // Exit code based on whether at least one provider works
    const exitCode = working.length > 0 ? 0 : 1;
    console.log(`\nExit code: ${exitCode}`);
    process.exit(exitCode);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
