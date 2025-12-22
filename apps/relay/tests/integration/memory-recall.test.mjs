/**
 * Integration Test: Memory Recall (5/5 Hard Gate)
 * 
 * Tests that Session B can recall messages from Session A
 * Must pass 5 out of 5 runs to be considered successful.
 * 
 * Usage:
 *   DATABASE_URL_MVP=<connection string> node tests/integration/memory-recall.test.mjs
 *   
 * Or with server running:
 *   DATABASE_URL_MVP=<connection string> TEST_BASE_URL=http://localhost:8080 node tests/integration/memory-recall.test.mjs
 */

import { randomUUID } from 'crypto';

// Configuration
const TEST_RUNS = 5;
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:8080';
const FIXED_USER_ID = `test-user-memory-recall-${Date.now()}`;

// ANSI colors for output
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
 * Generate unique marker for this test run
 */
function generateMarker() {
    const timestamp = Date.now();
    const random = randomUUID().slice(0, 8);
    return `ECHO-DELTA-${timestamp}-${random}`;
}

/**
 * Make HTTP request
 */
async function request(method, path, body = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'x-jarvis-user-id': FIXED_USER_ID
        }
    };

    // Always send a body when Content-Type is application/json to avoid Fastify's empty body error
    options.body = JSON.stringify(body || {});

    const response = await fetch(`${BASE_URL}${path}`, options);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(`${method} ${path} failed: ${response.status} - ${JSON.stringify(data)}`);
    }

    return data;
}

/**
 * Run single test iteration
 * @param {number} iteration 
 * @returns {Promise<{passed: boolean, marker: string, error?: string}>}
 */
async function runIteration(iteration) {
    const marker = generateMarker();

    log('cyan', `\n=== Iteration ${iteration + 1}/${TEST_RUNS} ===`);
    log('cyan', `Marker: ${marker}`);

    try {
        // Step 1: Start Session A
        log('yellow', '1) Starting Session A...');
        const sessionA = await request('POST', '/session/start');
        const sessionAId = sessionA.session_id;
        log('yellow', `   Session A ID: ${sessionAId}`);

        // Step 2: Append unique marker message
        log('yellow', '2) Appending marker message...');
        const message = await request('POST', `/session/${sessionAId}/message`, {
            role: 'user',
            content: marker
        });
        log('yellow', `   Message ID: ${message.message_id}`);

        // Step 3: End Session A
        log('yellow', '3) Ending Session A...');
        await request('POST', '/session/end', { session_id: sessionAId });
        log('yellow', '   Session A ended');

        // Step 4: Start Session B
        log('yellow', '4) Starting Session B...');
        const sessionB = await request('POST', '/session/start');
        const sessionBId = sessionB.session_id;
        log('yellow', `   Session B ID: ${sessionBId}`);

        // Step 5: Check bootstrap context for marker
        log('yellow', '5) Checking bootstrap context...');
        const bootstrapContext = sessionB.bootstrap_context;
        const lastTranscript = bootstrapContext?.last_session_transcript;

        if (!lastTranscript) {
            throw new Error('last_session_transcript is null or undefined');
        }

        // Search for marker in transcript
        const foundMarker = lastTranscript.some(msg => msg.content === marker);

        if (!foundMarker) {
            const transcriptContent = lastTranscript.map(m => m.content).join(', ');
            throw new Error(`Marker not found in transcript. Transcript: [${transcriptContent}]`);
        }

        log('green', `✓ Iteration ${iteration + 1} PASSED - Marker found in Session B bootstrap context`);

        // Cleanup: End Session B
        await request('POST', '/session/end', { session_id: sessionBId });

        return { passed: true, marker };
    } catch (error) {
        log('red', `✗ Iteration ${iteration + 1} FAILED: ${error.message}`);
        return { passed: false, marker, error: error.message };
    }
}

/**
 * Main test runner
 */
async function main() {
    console.log('\n' + '='.repeat(60));
    log('cyan', 'JARVIS MVP - Memory Recall Integration Test');
    log('cyan', `Target: ${BASE_URL}`);
    log('cyan', `User ID: ${FIXED_USER_ID}`);
    log('cyan', `Required: ${TEST_RUNS}/${TEST_RUNS} passes`);
    console.log('='.repeat(60));

    const results = [];

    // Run all iterations
    for (let i = 0; i < TEST_RUNS; i++) {
        const result = await runIteration(i);
        results.push(result);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    log('cyan', 'RESULTS SUMMARY');
    console.log('='.repeat(60));

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    results.forEach((r, i) => {
        if (r.passed) {
            log('green', `  Iteration ${i + 1}: PASSED`);
        } else {
            log('red', `  Iteration ${i + 1}: FAILED - ${r.error}`);
        }
    });

    console.log('');
    log(passed === TEST_RUNS ? 'green' : 'red',
        `Final: ${passed}/${TEST_RUNS} passed, ${failed}/${TEST_RUNS} failed`);

    if (passed === TEST_RUNS) {
        log('green', '\n✓ HARD GATE PASSED: Memory recall is deterministic');
        process.exit(0);
    } else {
        log('red', '\n✗ HARD GATE FAILED: Memory recall is NOT deterministic');
        process.exit(1);
    }
}

// Run tests
main().catch(err => {
    log('red', 'Test runner error:', err);
    process.exit(1);
});
