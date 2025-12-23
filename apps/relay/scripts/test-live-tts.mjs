#!/usr/bin/env node
/**
 * Live TTS WebSocket Test
 * Tests Cartesia and Fish Audio streaming against Cloud Run
 */
import WebSocket from 'ws';

const RELAY_URL = process.env.RELAY_URL || 'wss://jarvis-relay-mvp-987409605790.europe-west1.run.app/ws';
const TEST_TEXT = 'Hello JARVIS, this is a voice streaming test.';

async function testProvider(providerName) {
    return new Promise((resolve, reject) => {
        console.log(`\n${'='.repeat(50)}`);
        console.log(`Testing: ${providerName.toUpperCase()}`);
        console.log('='.repeat(50));

        const ws = new WebSocket(RELAY_URL);
        const messages = [];
        let startTime = null;

        const timeout = setTimeout(() => {
            ws.close();
            reject(new Error(`Timeout after 30s for ${providerName}`));
        }, 30000);

        ws.on('open', () => {
            console.log('✅ WebSocket connected');
        });

        ws.on('message', (data) => {
            const msg = JSON.parse(data.toString());
            messages.push(msg);

            if (msg.type === 'connected') {
                console.log(`✅ Server version: ${msg.version}`);
                // Bind session
                ws.send(JSON.stringify({
                    type: 'session.bind',
                    user_id: 'test-user',
                    session_id: `test-session-${Date.now()}`
                }));
            }

            if (msg.type === 'session.bound') {
                console.log('✅ Session bound');
                startTime = Date.now();
                // Request speech with preferred provider
                ws.send(JSON.stringify({
                    type: 'assistant.speak',
                    text: TEST_TEXT,
                    voice_provider: providerName
                }));
            }

            if (msg.type === 'transcript.delta') {
                console.log(`📝 Transcript: "${msg.text.slice(0, 40)}..."`);
            }

            if (msg.type === 'audio.frame' && msg.seq === 0) {
                console.log(`🔊 First audio frame received (codec: ${msg.codec})`);
            }

            if (msg.type === 'audio.end') {
                const duration = Date.now() - startTime;
                console.log(`\n✅ STREAM COMPLETE:`);
                console.log(`   Provider: ${msg.provider}`);
                console.log(`   Total frames: ${msg.total_frames}`);
                console.log(`   Duration: ${duration}ms`);

                const fallbackUsed = msg.provider !== providerName;
                console.log(`   Fallback used: ${fallbackUsed ? '⚠️ YES' : '✅ NO'}`);

                clearTimeout(timeout);
                ws.close();

                resolve({
                    provider: msg.provider,
                    expectedProvider: providerName,
                    totalFrames: msg.total_frames,
                    duration,
                    fallbackUsed
                });
            }

            if (msg.type === 'error') {
                console.log(`❌ Error: ${msg.code} - ${msg.message}`);
            }

            if (msg.type === 'provider.switched') {
                console.log(`⚠️ Provider switched: ${msg.from} → ${msg.to}`);
            }
        });

        ws.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });

        ws.on('close', () => {
            console.log('WebSocket closed');
        });
    });
}

async function main() {
    console.log('TTS Live Streaming Test');
    console.log('========================');
    console.log(`Relay URL: ${RELAY_URL}`);

    const results = [];

    // Test Cartesia
    try {
        const cartesiaResult = await testProvider('cartesia');
        results.push({ name: 'cartesia', ...cartesiaResult });
    } catch (err) {
        console.log(`❌ Cartesia test failed: ${err.message}`);
        results.push({ name: 'cartesia', error: err.message });
    }

    // Wait a bit between tests
    await new Promise(r => setTimeout(r, 2000));

    // Test Fish Audio
    try {
        const fishResult = await testProvider('fishaudio');
        results.push({ name: 'fishaudio', ...fishResult });
    } catch (err) {
        console.log(`❌ Fish Audio test failed: ${err.message}`);
        results.push({ name: 'fishaudio', error: err.message });
    }

    // Summary
    console.log(`\n${'='.repeat(50)}`);
    console.log('FINAL RESULTS');
    console.log('='.repeat(50));

    for (const r of results) {
        if (r.error) {
            console.log(`❌ ${r.name}: FAILED - ${r.error}`);
        } else if (r.fallbackUsed) {
            console.log(`⚠️ ${r.name}: FALLBACK USED (got ${r.provider}, expected ${r.expectedProvider})`);
        } else {
            console.log(`✅ ${r.name}: SUCCESS - ${r.totalFrames} frames in ${r.duration}ms`);
        }
    }

    const allSuccess = results.every(r => !r.error && !r.fallbackUsed);
    console.log(`\nOverall: ${allSuccess ? '✅ ALL PASSED' : '⚠️ SOME ISSUES'}`);

    process.exit(allSuccess ? 0 : 1);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
