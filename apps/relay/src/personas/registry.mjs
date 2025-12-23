/**
 * Persona Registry - File-based persona loader
 * @module personas/registry
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Cached persona prompts (loaded at startup)
 * @type {Map<string, string>}
 */
const personaCache = new Map();

/**
 * Default persona ID when requested persona is not found
 */
const DEFAULT_PERSONA = 'default';

/**
 * Available personas and their file names
 */
const PERSONA_FILES = {
    jarvis: 'jarvis.system.txt',
    default: 'default.system.txt'
};

/**
 * Load a persona file from disk
 * @param {string} filename 
 * @returns {Promise<string>}
 */
async function loadPersonaFile(filename) {
    const filePath = join(__dirname, filename);
    try {
        const content = await readFile(filePath, 'utf-8');
        return content.trim();
    } catch (err) {
        console.error(`Failed to load persona file: ${filename}`, err);
        throw err;
    }
}

/**
 * Initialize the persona registry - loads all personas into cache
 * Should be called at server startup
 * @returns {Promise<void>}
 */
export async function initPersonaRegistry() {
    console.log('[Persona Registry] Initializing...');

    for (const [personaId, filename] of Object.entries(PERSONA_FILES)) {
        try {
            const content = await loadPersonaFile(filename);
            personaCache.set(personaId, content);
            console.log(`[Persona Registry] Loaded persona: ${personaId} (${content.length} chars)`);
        } catch (err) {
            console.error(`[Persona Registry] Failed to load persona: ${personaId}`, err);
            // Don't throw - allow server to start with partial personas
        }
    }

    // Ensure default persona exists
    if (!personaCache.has(DEFAULT_PERSONA)) {
        console.warn('[Persona Registry] Default persona not loaded, using fallback');
        personaCache.set(DEFAULT_PERSONA, 'You are a helpful AI assistant.');
    }

    console.log(`[Persona Registry] Initialized with ${personaCache.size} personas`);
}

/**
 * Get a persona prompt by ID
 * Falls back to default if persona is not found
 * @param {string} personaId 
 * @returns {string}
 */
export function getPersonaPrompt(personaId) {
    if (personaCache.has(personaId)) {
        return personaCache.get(personaId);
    }

    console.warn(`[Persona Registry] Unknown persona: ${personaId}, using default`);
    return personaCache.get(DEFAULT_PERSONA) || 'You are a helpful AI assistant.';
}

/**
 * Check if a persona exists
 * @param {string} personaId 
 * @returns {boolean}
 */
export function hasPersona(personaId) {
    return personaCache.has(personaId);
}

/**
 * Get list of available persona IDs
 * @returns {string[]}
 */
export function getAvailablePersonas() {
    return Array.from(personaCache.keys());
}
