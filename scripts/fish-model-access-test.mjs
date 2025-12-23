/**
 * Fish Audio Model Access Test
 * Tests if the API key can access the specific model
 */

const FISH_API_KEY = process.env.FISH_API_KEY;
const VOICE_ID = process.env.VOICE_ID || '93ab5bea92794ef8ac0885c84d567d76';

async function testModelAccess() {
    console.log('\n=== FISH AUDIO MODEL ACCESS TEST ===\n');
    console.log(`Testing access to model: ${VOICE_ID}`);
    console.log(`API Key (last 8 chars): ...${FISH_API_KEY?.slice(-8) || 'NOT SET'}\n`);

    // Test 1: GET model info
    console.log('1) Fetching model info...');
    try {
        const modelResp = await fetch(`https://api.fish.audio/model/${VOICE_ID}`, {
            headers: {
                'Authorization': `Bearer ${FISH_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (modelResp.ok) {
            const model = await modelResp.json();
            console.log(`   ✅ Model accessible`);
            console.log(`   Title: ${model.title}`);
            console.log(`   Author: ${model.author?.nickname}`);
            console.log(`   Visibility: ${model.visibility}`);
        } else {
            console.log(`   ❌ Model NOT accessible: HTTP ${modelResp.status}`);
            const err = await modelResp.text();
            console.log(`   Error: ${err}`);
        }
    } catch (e) {
        console.log(`   ❌ Fetch error: ${e.message}`);
    }

    // Test 2: TTS with reference_id
    console.log('\n2) Testing TTS with reference_id...');
    try {
        const ttsResp = await fetch('https://api.fish.audio/v1/tts', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${FISH_API_KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'audio/mpeg',
                'model': 's1'
            },
            body: JSON.stringify({
                text: 'Test.',
                format: 'mp3',
                latency: 'normal',
                reference_id: VOICE_ID
            })
        });

        if (ttsResp.ok) {
            const reader = ttsResp.body.getReader();
            let bytes = 0;
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                bytes += value.length;
            }
            console.log(`   ✅ TTS successful: ${bytes} bytes`);
        } else {
            console.log(`   ❌ TTS failed: HTTP ${ttsResp.status}`);
            const err = await ttsResp.text();
            console.log(`   Error: ${err}`);
        }
    } catch (e) {
        console.log(`   ❌ Fetch error: ${e.message}`);
    }

    // Test 3: TTS without reference_id (default voice)
    console.log('\n3) Testing TTS WITHOUT reference_id (default)...');
    try {
        const ttsResp = await fetch('https://api.fish.audio/v1/tts', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${FISH_API_KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'audio/mpeg',
                'model': 's1'
            },
            body: JSON.stringify({
                text: 'Test.',
                format: 'mp3',
                latency: 'normal'
            })
        });

        if (ttsResp.ok) {
            const reader = ttsResp.body.getReader();
            let bytes = 0;
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                bytes += value.length;
            }
            console.log(`   ✅ TTS successful: ${bytes} bytes`);
        } else {
            console.log(`   ❌ TTS failed: HTTP ${ttsResp.status}`);
            const err = await ttsResp.text();
            console.log(`   Error: ${err}`);
        }
    } catch (e) {
        console.log(`   ❌ Fetch error: ${e.message}`);
    }
}

testModelAccess().catch(console.error);
