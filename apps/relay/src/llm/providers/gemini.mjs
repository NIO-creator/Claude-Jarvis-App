/**
 * Google Gemini LLM Provider
 * Fallback LLM provider using Google AI Studio (Gemini) API
 * @module llm/providers/gemini
 */

import { LLMProvider } from './types.mjs';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-1.5-flash';
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TEMPERATURE = 0.7;

export class GeminiProvider extends LLMProvider {
    name = 'gemini';

    constructor() {
        super();
        this.apiKey = process.env.GEMINI_API_KEY;
        this.model = process.env.LLM_MODEL_GEMINI || DEFAULT_MODEL;
        this.maxTokens = parseInt(process.env.LLM_MAX_TOKENS || String(DEFAULT_MAX_TOKENS), 10);
        this.temperature = parseFloat(process.env.LLM_TEMPERATURE || String(DEFAULT_TEMPERATURE));
    }

    async isAvailable() {
        return Boolean(this.apiKey);
    }

    /**
     * Convert OpenAI-style messages to Gemini format
     * @param {Array<{role: string, content: string}>} messages
     * @returns {{ systemInstruction: string, contents: Array<{role: string, parts: Array<{text: string}>}> }}
     */
    _convertMessages(messages) {
        let systemInstruction = '';
        const contents = [];

        for (const msg of messages) {
            if (msg.role === 'system') {
                // Gemini uses systemInstruction separately
                systemInstruction += (systemInstruction ? '\n\n' : '') + msg.content;
            } else {
                // Gemini uses 'user' and 'model' (not 'assistant')
                const role = msg.role === 'assistant' ? 'model' : 'user';
                contents.push({
                    role,
                    parts: [{ text: msg.content }]
                });
            }
        }

        return { systemInstruction, contents };
    }

    /**
     * Generate a response from Gemini
     * @param {import('./types.mjs').LLMRequest} request
     * @returns {Promise<import('./types.mjs').LLMResponse>}
     */
    async generate(request) {
        if (!await this.isAvailable()) {
            throw new Error('Gemini not configured');
        }

        const model = request.model || this.model;
        const maxTokens = request.max_tokens || this.maxTokens;
        const temperature = request.temperature ?? this.temperature;

        const { systemInstruction, contents } = this._convertMessages(request.messages);

        console.log(`[Gemini] Calling ${model} with ${contents.length} messages`);

        const url = `${GEMINI_API_URL}/${model}:generateContent?key=${this.apiKey}`;

        const requestBody = {
            contents,
            generationConfig: {
                maxOutputTokens: maxTokens,
                temperature
            }
        };

        // Add system instruction if present
        if (systemInstruction) {
            requestBody.systemInstruction = {
                parts: [{ text: systemInstruction }]
            };
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorBody = await response.text();
            const error = new Error(`Gemini API error: ${response.status}`);
            error.status = response.status;
            error.body = errorBody;
            throw error;
        }

        const data = await response.json();

        if (!data.candidates || data.candidates.length === 0) {
            throw new Error('Gemini returned no candidates');
        }

        const candidate = data.candidates[0];
        const content = candidate.content?.parts?.[0]?.text || '';

        // Gemini uses different token counting
        const promptTokens = data.usageMetadata?.promptTokenCount || 0;
        const completionTokens = data.usageMetadata?.candidatesTokenCount || 0;

        console.log(`[Gemini] Response: ${content.length} chars, ${promptTokens + completionTokens} tokens`);

        return {
            content,
            model,
            provider: this.name,
            usage: {
                prompt_tokens: promptTokens,
                completion_tokens: completionTokens
            }
        };
    }

    getStatus() {
        return {
            available: Boolean(this.apiKey),
            isPrimary: false,
            model: this.model
        };
    }
}

export default GeminiProvider;
