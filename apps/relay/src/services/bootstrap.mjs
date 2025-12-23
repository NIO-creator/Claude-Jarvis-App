/**
 * Bootstrap Context Builder
 * Builds the context payload for agent prompts
 * @module services/bootstrap
 */

import { getAllFacts, getLastSessionTranscript } from './memory.mjs';
import { getPersonaPrompt } from '../personas/registry.mjs';

const SYSTEM_INSTRUCTIONS_VERSION = '1.1.0-persona';

/**
 * Default knowledge base packs (stubbed for MVP)
 */
const KB_PACKS = {
    none: '',
    default: ''
};

/**
 * Build bootstrap context for agent prompts
 * @param {Object} params
 * @param {string} params.userId - Internal user UUID
 * @param {string} [params.personaId='jarvis'] - Persona identifier
 * @param {string} [params.kbPackId='none'] - Knowledge base pack identifier
 * @returns {Promise<{
 *   persona_prompt: string,
 *   kb_prompt: string,
 *   memory_facts: Array<{fact_key: string, fact_value: string, confidence: number}>,
 *   last_session_transcript: Array<{role: string, content: string, created_at: string}> | null,
 *   system_instructions_version: string
 * }>}
 */
export async function buildBootstrapContext({ userId, personaId = 'jarvis', kbPackId = 'none' }) {
    // Fetch memory facts and last session transcript in parallel
    const [memoryFacts, lastSessionTranscript] = await Promise.all([
        getAllFacts(userId),
        getLastSessionTranscript(userId)
    ]);

    // Get persona prompt from file-based registry (with fallback)
    const personaPrompt = getPersonaPrompt(personaId);

    // Get KB prompt (with fallback)
    const kbPrompt = KB_PACKS[kbPackId] || KB_PACKS.none;

    return {
        persona_prompt: personaPrompt,
        kb_prompt: kbPrompt,
        memory_facts: memoryFacts.map(f => ({
            fact_key: f.fact_key,
            fact_value: f.fact_value,
            confidence: parseFloat(f.confidence)
        })),
        last_session_transcript: lastSessionTranscript ? lastSessionTranscript.map(m => ({
            role: m.role,
            content: m.content,
            created_at: m.created_at
        })) : null,
        system_instructions_version: SYSTEM_INSTRUCTIONS_VERSION
    };
}
