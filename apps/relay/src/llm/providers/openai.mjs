/**
 * OpenAI LLM Provider
 * Primary LLM provider using OpenAI API
 * @module llm/providers/openai
 */

import { LLMProvider } from './types.mjs';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o';
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TEMPERATURE = 0.7;

export class OpenAIProvider extends LLMProvider {
    name = 'openai';

    constructor() {
        super();
        this.apiKey = process.env.OPENAI_API_KEY;
        this.model = process.env.LLM_MODEL_OPENAI || DEFAULT_MODEL;
        this.maxTokens = parseInt(process.env.LLM_MAX_TOKENS || String(DEFAULT_MAX_TOKENS), 10);
        this.temperature = parseFloat(process.env.LLM_TEMPERATURE || String(DEFAULT_TEMPERATURE));
    }

    async isAvailable() {
        return Boolean(this.apiKey);
    }

    /**
     * Generate a response from OpenAI
     * @param {import('./types.mjs').LLMRequest} request
     * @returns {Promise<import('./types.mjs').LLMResponse>}
     */
    async generate(request) {
        if (!await this.isAvailable()) {
            throw new Error('OpenAI not configured');
        }

        const model = request.model || this.model;
        const max_tokens = request.max_tokens || this.maxTokens;
        const temperature = request.temperature ?? this.temperature;

        console.log(`[OpenAI] Calling ${model} with ${request.messages.length} messages`);

        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model,
                messages: request.messages,
                max_tokens,
                temperature
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            const error = new Error(`OpenAI API error: ${response.status}`);
            error.status = response.status;
            error.body = errorBody;
            throw error;
        }

        const data = await response.json();

        if (!data.choices || data.choices.length === 0) {
            throw new Error('OpenAI returned no choices');
        }

        const content = data.choices[0].message?.content || '';

        console.log(`[OpenAI] Response: ${content.length} chars, ${data.usage?.total_tokens || 0} tokens`);

        return {
            content,
            model: data.model,
            provider: this.name,
            usage: {
                prompt_tokens: data.usage?.prompt_tokens || 0,
                completion_tokens: data.usage?.completion_tokens || 0
            }
        };
    }

    getStatus() {
        return {
            available: Boolean(this.apiKey),
            isPrimary: true,
            model: this.model
        };
    }
}

export default OpenAIProvider;
