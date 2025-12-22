/**
 * Memory Service - Memory facts and transcript retrieval
 * @module services/memory
 */

import { query, withTransaction } from '../db-client.mjs';
import { getLastEndedSession } from './sessions.mjs';
import { getSessionMessages } from './messages.mjs';

/**
 * Upsert a memory fact for a user
 * @param {string} userId 
 * @param {string} factKey 
 * @param {string} factValue 
 * @param {number} [confidence=1.0] 
 * @returns {Promise<{id: string, fact_key: string, fact_value: string, confidence: number}>}
 */
export async function upsertFact(userId, factKey, factValue, confidence = 1.0) {
    // Validate confidence
    if (confidence < 0 || confidence > 1) {
        throw new Error('Confidence must be between 0 and 1');
    }

    // Use transaction to ensure commit
    return withTransaction(async (client) => {
        const result = await client.query(
            `INSERT INTO memory_facts (user_id, fact_key, fact_value, confidence)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id, fact_key) 
             DO UPDATE SET 
               fact_value = EXCLUDED.fact_value,
               confidence = EXCLUDED.confidence,
               updated_at = now()
             RETURNING id, fact_key, fact_value, confidence`,
            [userId, factKey, factValue, confidence]
        );
        return result.rows[0];
    });
}

/**
 * Get all memory facts for a user
 * @param {string} userId 
 * @returns {Promise<Array<{id: string, fact_key: string, fact_value: string, confidence: number, created_at: string}>>}
 */
export async function getAllFacts(userId) {
    const result = await query(
        `SELECT id, fact_key, fact_value, confidence, created_at, updated_at
         FROM memory_facts
         WHERE user_id = $1
         ORDER BY created_at ASC, id ASC`,
        [userId]
    );
    return result.rows;
}

/**
 * Get the transcript of the last ended session for a user
 * @param {string} userId 
 * @returns {Promise<Array<{id: string, role: string, content: string, created_at: string}> | null>}
 */
export async function getLastSessionTranscript(userId) {
    // Get the last ended session
    const lastSession = await getLastEndedSession(userId);
    if (!lastSession) {
        return null;
    }

    // Get all messages for that session
    return getSessionMessages(lastSession.id);
}

/**
 * Delete a memory fact
 * @param {string} userId 
 * @param {string} factKey 
 * @returns {Promise<boolean>}
 */
export async function deleteFact(userId, factKey) {
    const result = await query(
        `DELETE FROM memory_facts
         WHERE user_id = $1 AND fact_key = $2
         RETURNING id`,
        [userId, factKey]
    );
    return result.rows.length > 0;
}
