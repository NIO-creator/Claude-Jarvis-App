/**
 * Fish Audio Model Discovery Script
 * Lists all models available to this account
 * 
 * Usage: node scripts/fish-model-discovery.mjs
 */

const FISH_API_KEY = process.env.FISH_API_KEY;

if (!FISH_API_KEY) {
    console.error('ERROR: FISH_API_KEY environment variable not set');
    process.exit(1);
}

async function listMyModels() {
    console.log('\n=== FISH AUDIO MODEL DISCOVERY ===\n');

    // 1. List self-owned models (my_models)
    console.log('📋 Listing SELF-OWNED models...\n');
    try {
        const response = await fetch('https://api.fish.audio/model?self=true&page_size=50', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${FISH_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`API Error (${response.status}): ${errorText}`);
            return;
        }

        const data = await response.json();
        console.log(`Found ${data.items?.length || 0} self-owned models:\n`);

        if (data.items && data.items.length > 0) {
            console.log('| Model ID | Title | Created |');
            console.log('|----------|-------|---------|');
            for (const model of data.items) {
                const createdAt = model.created_at ? new Date(model.created_at).toISOString().split('T')[0] : 'N/A';
                console.log(`| ${model._id} | ${model.title || 'Untitled'} | ${createdAt} |`);
            }
        } else {
            console.log('No self-owned models found.');
        }

        return data.items || [];
    } catch (err) {
        console.error('Fetch error:', err.message);
        return [];
    }
}

async function validateModelById(modelId) {
    console.log(`\n🔍 Validating model ID: ${modelId}\n`);
    try {
        const response = await fetch(`https://api.fish.audio/model/${modelId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${FISH_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.log(`❌ Model ${modelId} NOT accessible (HTTP ${response.status})`);
            return null;
        }

        const model = await response.json();
        console.log(`✅ Model found:`);
        console.log(`   ID: ${model._id}`);
        console.log(`   Title: ${model.title}`);
        console.log(`   Author: ${model.author?.nickname || 'N/A'}`);
        console.log(`   Visibility: ${model.visibility || 'N/A'}`);
        return model;
    } catch (err) {
        console.error('Validation error:', err.message);
        return null;
    }
}

async function listPublicModels() {
    console.log('\n📋 Listing TOP PUBLIC models (for reference)...\n');
    try {
        const response = await fetch('https://api.fish.audio/model?page_size=10&sort=score', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${FISH_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`API Error (${response.status}): ${errorText}`);
            return;
        }

        const data = await response.json();
        console.log(`Showing top ${data.items?.length || 0} public models:\n`);

        if (data.items && data.items.length > 0) {
            console.log('| Model ID | Title | Author | Score |');
            console.log('|----------|-------|--------|-------|');
            for (const model of data.items) {
                console.log(`| ${model._id} | ${(model.title || 'Untitled').substring(0, 30)} | ${model.author?.nickname || 'N/A'} | ${model.score || 0} |`);
            }
        }

        return data.items || [];
    } catch (err) {
        console.error('Fetch error:', err.message);
        return [];
    }
}

async function main() {
    // 1. List self-owned models
    const myModels = await listMyModels();

    // 2. Validate the currently configured model ID
    const currentVoiceId = '93ab5bea92794ef8ac0885c84d567d76';
    await validateModelById(currentVoiceId);

    // 3. List top public models for reference
    await listPublicModels();

    // Summary
    console.log('\n=== SUMMARY ===\n');
    if (myModels.length > 0) {
        console.log('✅ Custom models available. Recommended model:');
        console.log(`   ID: ${myModels[0]._id}`);
        console.log(`   Title: ${myModels[0].title}`);
    } else {
        console.log('⚠️  No self-owned models found.');
        console.log('   To use a custom voice, you need to:');
        console.log('   1. Create a voice clone at https://fish.audio');
        console.log('   2. Or use a public model (see above)');
    }
}

main().catch(console.error);
