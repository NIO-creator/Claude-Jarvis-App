/**
 * Fish Audio Account Debug
 * Check the account associated with the API key
 */

const FISH_API_KEY = process.env.FISH_API_KEY;

async function checkAccount() {
    console.log('\n=== FISH AUDIO ACCOUNT DEBUG ===\n');
    console.log(`API Key (last 8 chars): ...${FISH_API_KEY?.slice(-8) || 'NOT SET'}`);

    // Get user info
    try {
        const response = await fetch('https://api.fish.audio/wallet/self/api-credit', {
            headers: {
                'Authorization': `Bearer ${FISH_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        console.log(`\nAPI Credit endpoint: HTTP ${response.status}`);
        if (response.ok) {
            const data = await response.json();
            console.log('Credit info:', JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.log(`Error: ${e.message}`);
    }

    // List self models
    try {
        const response = await fetch('https://api.fish.audio/model?self=true&page_size=10', {
            headers: {
                'Authorization': `Bearer ${FISH_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        console.log(`\nSelf models endpoint: HTTP ${response.status}`);
        if (response.ok) {
            const data = await response.json();
            console.log(`Found ${data.items?.length || 0} self-owned models:`);
            for (const model of (data.items || [])) {
                console.log(`  - ${model._id}: ${model.title}`);
            }
        }
    } catch (e) {
        console.log(`Error: ${e.message}`);
    }

    // Try to access the specific model
    const modelId = '93ab5bea92794ef8ac0885c84d567d76';
    try {
        const response = await fetch(`https://api.fish.audio/model/${modelId}`, {
            headers: {
                'Authorization': `Bearer ${FISH_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        console.log(`\nModel ${modelId}: HTTP ${response.status}`);
        if (response.ok) {
            const data = await response.json();
            console.log(`  Title: ${data.title}`);
            console.log(`  Author: ${data.author?.nickname}`);
            console.log(`  Author ID: ${data.author?._id || data.author_id || 'N/A'}`);
            console.log(`  Visibility: ${data.visibility}`);
        }
    } catch (e) {
        console.log(`Error: ${e.message}`);
    }
}

checkAccount().catch(console.error);
