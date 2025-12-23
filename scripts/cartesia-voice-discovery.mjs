/**
 * Cartesia Voice Discovery Script
 * Lists available voices from Cartesia API
 */

const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY;

async function listVoices() {
    console.log('\n=== CARTESIA VOICE DISCOVERY ===\n');
    console.log(`API Key (last 8 chars): ...${CARTESIA_API_KEY?.slice(-8) || 'NOT SET'}`);

    try {
        const response = await fetch('https://api.cartesia.ai/voices', {
            method: 'GET',
            headers: {
                'X-API-Key': CARTESIA_API_KEY,
                'Cartesia-Version': '2024-06-10'
            }
        });

        console.log(`\nVoices endpoint: HTTP ${response.status}`);

        if (!response.ok) {
            const err = await response.text();
            console.error(`Error: ${err}`);
            return;
        }

        const voices = await response.json();
        console.log(`\nFound ${voices.length} voices:\n`);

        // Show first 15 voices
        console.log('| Voice ID | Name | Language | Gender |');
        console.log('|----------|------|----------|--------|');
        for (const voice of voices.slice(0, 15)) {
            console.log(`| ${voice.id} | ${voice.name?.substring(0, 20) || 'N/A'} | ${voice.language || 'N/A'} | ${voice.gender || 'N/A'} |`);
        }

        // Find a good default voice (English, male, professional)
        const recommended = voices.find(v =>
            v.language?.includes('en') &&
            v.name?.toLowerCase().includes('british') ||
            v.name?.toLowerCase().includes('professional')
        ) || voices.find(v => v.language?.includes('en')) || voices[0];

        if (recommended) {
            console.log('\n=== RECOMMENDED VOICE ===');
            console.log(`ID: ${recommended.id}`);
            console.log(`Name: ${recommended.name}`);
            console.log(`Language: ${recommended.language}`);
        }

    } catch (err) {
        console.error('Fetch error:', err.message);
    }
}

listVoices().catch(console.error);
