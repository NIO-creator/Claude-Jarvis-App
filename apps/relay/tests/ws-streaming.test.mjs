/**
 * WebSocket Streaming Test
 * End-to-end test for voice streaming over WebSocket
 * @module tests/ws-streaming.test.mjs
 */

import WebSocket from 'ws';

// Configuration
const WS_URL = process.env.WS_URL || 'ws://localhost:8080/ws';
const TEST_USER_ID = `test-ws-${Date.now()}`;
const TEST_SESSION_ID = `session-${Date.now()}`;
const TEST_TEXT = 'Hello JARVIS, this is a streaming test.';

// ANSI colors
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m'
};

function log(color, ...args) {
    console.log(colors[color], ...args, colors.reset);
}

/**
 * Run WebSocket streaming test
 */
async function runTest() {
    return new Promise((resolve, reject) => {
        const results = {
            connected: false,
            sessionBound: false,
            audioFrames: [],
            audioEnd: null,
            transcriptDelta: null,
            errors: []
        };

        log('cyan', `\n=== WebSocket Streaming Test ===`);
        log('cyan', `URL: ${WS_URL}`);
        log('cyan', `User ID: ${TEST_USER_ID}`);
        log('cyan', `Session ID: ${TEST_SESSION_ID}`);
        log('cyan', `Test Text: "${TEST_TEXT}"\n`);

        const ws = new WebSocket(WS_URL);
        const timeout = setTimeout(() => {
            ws.close();
            reject(new Error('Test timeout after 30 seconds'));
        }, 30000);

        ws.on('open', () => {
            log('yellow', '1) WebSocket connected');
        });

        ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());

                switch (msg.type) {
                    case 'connected':
                        results.connected = true;
                        log('green', `   ✓ Received: connected (version=${msg.version})`);

                        // Send session.bind
                        log('yellow', '2) Sending session.bind...');
                        ws.send(JSON.stringify({
                            type: 'session.bind',
                            user_id: TEST_USER_ID,
                            session_id: TEST_SESSION_ID
                        }));
                        break;

                    case 'session.bound':
                        results.sessionBound = true;
                        log('green', `   ✓ Received: session.bound`);

                        // Send assistant.speak
                        log('yellow', '3) Sending assistant.speak...');
                        ws.send(JSON.stringify({
                            type: 'assistant.speak',
                            text: TEST_TEXT
                        }));
                        break;

                    case 'transcript.delta':
                        results.transcriptDelta = msg;
                        log('green', `   ✓ Received: transcript.delta (text="${msg.text?.substring(0, 30)}...")`);
                        break;

                    case 'audio.frame':
                        results.audioFrames.push({
                            seq: msg.seq,
                            codec: msg.codec,
                            dataLength: msg.data_b64?.length || 0,
                            sample_rate_hz: msg.sample_rate_hz,
                            channels: msg.channels
                        });

                        if (results.audioFrames.length === 1) {
                            log('green', `   ✓ Receiving audio.frame messages (codec=${msg.codec}, sample_rate=${msg.sample_rate_hz}Hz, channels=${msg.channels})...`);
                        }
                        break;

                    case 'audio.end':
                        results.audioEnd = msg;
                        log('green', `   ✓ Received: audio.end (frames=${msg.total_frames}, provider=${msg.provider})`);

                        // Test complete
                        clearTimeout(timeout);
                        ws.close();
                        break;

                    case 'error':
                        results.errors.push(msg);
                        log('red', `   ✗ Received error: ${msg.code} - ${msg.message}`);
                        break;

                    case 'provider.switched':
                        log('yellow', `   ⚠ Provider switched: ${msg.from} → ${msg.to}`);
                        break;

                    default:
                        log('yellow', `   ? Unknown message type: ${msg.type}`);
                }
            } catch (e) {
                log('red', `   ✗ Failed to parse message: ${e.message}`);
            }
        });

        ws.on('close', () => {
            log('cyan', '\n=== Test Results ===');

            const passed =
                results.connected &&
                results.sessionBound &&
                results.audioFrames.length > 0 &&
                results.audioEnd !== null &&
                results.errors.length === 0;

            if (passed) {
                log('green', '✓ PASSED');
                log('green', `  Connected: ${results.connected}`);
                log('green', `  Session Bound: ${results.sessionBound}`);
                log('green', `  Audio Frames: ${results.audioFrames.length}`);
                log('green', `  Audio End Provider: ${results.audioEnd?.provider}`);
                log('green', `  Errors: ${results.errors.length}`);

                // Verify sequential seq values
                const seqs = results.audioFrames.map(f => f.seq);
                const isSequential = seqs.every((seq, i) => seq === i);
                log(isSequential ? 'green' : 'red', `  Sequential Frames: ${isSequential}`);

                // Verify codec present
                const hasCodec = results.audioFrames.every(f => f.codec);
                log(hasCodec ? 'green' : 'red', `  Codec Present: ${hasCodec}`);

                resolve(results);
            } else {
                log('red', '✗ FAILED');
                log('red', `  Connected: ${results.connected}`);
                log('red', `  Session Bound: ${results.sessionBound}`);
                log('red', `  Audio Frames: ${results.audioFrames.length}`);
                log('red', `  Audio End: ${results.audioEnd !== null}`);
                log('red', `  Errors: ${JSON.stringify(results.errors)}`);
                reject(new Error('Test failed: incomplete streaming flow'));
            }
        });

        ws.on('error', (err) => {
            clearTimeout(timeout);
            log('red', `WebSocket error: ${err.message}`);
            reject(err);
        });
    });
}

// Main
async function main() {
    try {
        const results = await runTest();

        console.log('\n' + '='.repeat(50));
        log('green', 'WebSocket Streaming Test: PASSED');
        console.log('='.repeat(50));

        console.log('\nFrame Summary:');
        console.log(`  Total Frames: ${results.audioFrames.length}`);
        console.log(`  Provider: ${results.audioEnd?.provider}`);
        if (results.audioFrames[0]) {
            console.log(`  Codec: ${results.audioFrames[0].codec}`);
            console.log(`  Sample Rate: ${results.audioFrames[0].sample_rate_hz} Hz`);
            console.log(`  Channels: ${results.audioFrames[0].channels}`);
        }

        process.exit(0);
    } catch (err) {
        console.log('\n' + '='.repeat(50));
        log('red', `WebSocket Streaming Test: FAILED - ${err.message}`);
        console.log('='.repeat(50));
        process.exit(1);
    }
}

main();
