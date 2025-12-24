/**
 * OpenAI Client - Provider-agnostic LLM interface
 * @module llm/openai-client
 */

// Configuration from environment
// Trim API key to remove any trailing whitespace/newlines from secrets
const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();
const LLM_MODEL = process.env.LLM_MODEL || 'gpt-4o';
const LLM_MAX_TOKENS = parseInt(process.env.LLM_MAX_TOKENS || '1024', 10);
const LLM_TEMPERATURE = parseFloat(process.env.LLM_TEMPERATURE || '0.7');
const OPENAI_API_URL = process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions';


/**
 * Check if OpenAI is configured
 * @returns {boolean}
 */
export function isConfigured() {
    return Boolean(OPENAI_API_KEY);
}

/**
 * Generate a response from the LLM
 * 
 * @param {{messages: Array<{role: string, content: string}>}} context - LLM context with messages array
 * @param {Object} [options] - Optional overrides
 * @param {string} [options.model] - Model to use
 * @param {number} [options.max_tokens] - Max tokens in response
 * @param {number} [options.temperature] - Temperature for generation
 * @returns {Promise<{content: string, model: string, usage: {prompt_tokens: number, completion_tokens: number}}>}
 * @throws {Error} If API call fails or OpenAI is not configured
 */
export async function generateResponse(context, options = {}) {
    if (!isConfigured()) {
        throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY environment variable.');
    }

    const model = options.model || LLM_MODEL;
    const max_tokens = options.max_tokens || LLM_MAX_TOKENS;
    const temperature = options.temperature ?? LLM_TEMPERATURE;

    const requestBody = {
        model,
        messages: context.messages,
        max_tokens,
        temperature
    };

    console.log(`[OpenAI] Calling ${model} with ${context.messages.length} messages`);

    const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[OpenAI] API error: ${response.status}`, errorBody);
        throw new Error(`OpenAI API error: ${response.status} - ${errorBody}`);
    }

    const data = await response.json();

    if (!data.choices || data.choices.length === 0) {
        throw new Error('OpenAI returned no choices');
    }

    const choice = data.choices[0];
    const content = choice.message?.content || '';

    console.log(`[OpenAI] Response received: ${content.length} chars, ${data.usage?.total_tokens || 0} tokens`);

    return {
        content,
        model: data.model,
        usage: {
            prompt_tokens: data.usage?.prompt_tokens || 0,
            completion_tokens: data.usage?.completion_tokens || 0
        }
    };
}

/**
 * Get LLM configuration status (for health checks)
 * @returns {{configured: boolean, model: string, api_url: string}}
 */
export function getStatus() {
    return {
        configured: isConfigured(),
        model: LLM_MODEL,
        api_url: OPENAI_API_URL.replace(/api\.openai\.com.*/, 'api.openai.com/...') // Redact full path
    };
}
