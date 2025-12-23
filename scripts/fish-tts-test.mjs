/**
 * Fish Audio TTS Direct Test
 * Tests TTS endpoint with custom voice model
 */

const FISH_API_KEY = process.env.FISH_API_KEY;
const VOICE_ID = '93ab5bea92794ef8ac0885c84d567d76';

async function testTTS(useVoiceId = true) {
    console.log(`\n=== FISH AUDIO TTS TEST ===`);
    console.log(`Using reference_id: ${useVoiceId ? VOICE_ID : 'NONE (default voice)'}\n`);

    const requestBody = {
        text: 'Hello, I am Jarvis, your intelligent voice assistant.',
        format: 'mp3',
        latency: 'normal'
    };

    if (useVoiceId) {
        requestBody.reference_id = VOICE_ID;
    }

    console.log('Request body:', JSON.stringify(requestBody, null, 2));

    try {
        const response = await fetch('https://api.fish.audio/v1/tts', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${FISH_API_KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'audio/mpeg',
                'model': 's1'
            },
            body: JSON.stringify(requestBody)
        });

        console.log(`\nResponse status: ${response.status}`);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            return false;
        }

        // Read and count bytes
        const reader = response.body.getReader();
        let totalBytes = 0;
        let chunks = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            totalBytes += value.length;
            chunks++;
        }

        console.log(`\n✅ SUCCESS: Received ${totalBytes} bytes in ${chunks} chunks`);
        return true;
    } catch (err) {
        console.error('Fetch error:', err.message);
        return false;
    }
}

async function main() {
    // Test 1: With custom voice ID
    console.log('\n--- TEST 1: Custom Voice ---');
    const customVoiceResult = await testTTS(true);

    // Test 2: Without voice ID (default voice)
    console.log('\n--- TEST 2: Default Voice ---');
    const defaultVoiceResult = await testTTS(false);

    console.log('\n=== RESULTS ===');
    console.log(`Custom voice (reference_id): ${customVoiceResult ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Default voice (no ref): ${defaultVoiceResult ? '✅ PASS' : '❌ FAIL'}`);

    if (customVoiceResult) {
        console.log('\n🎯 RECOMMENDATION: Custom voice model is working!');
        console.log(`   Model ID: ${VOICE_ID}`);
        console.log('   No changes needed to FISH_AUDIO_VOICE_ID_MVP');
    }
}

main().catch(console.error);
