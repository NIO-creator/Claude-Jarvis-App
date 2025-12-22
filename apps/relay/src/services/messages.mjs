/**
 * Messages Service - Append-only message storage
 * @module services/messages
 */

import { withTransaction, query } from '../db-client.mjs';

const VALID_ROLES = ['user', 'assistant', 'system'];

/**
 * Append a message to a session (append-only, transaction-wrapped)
 * @param {string} sessionId 
 * @param {string} role - user | assistant | system
 * @param {string} content 
 * @param {object} [metadata] - Optional metadata (not stored in MVP, reserved for future)
 * @returns {Promise<{id: string, created_at: string}>}
 */
export async function appendMessage(sessionId, role, content, metadata = null) {
    // Validate role
    if (!VALID_ROLES.includes(role)) {
        throw new Error(`Invalid role: ${role}. Must be one of: ${VALID_ROLES.join(', ')}`);
    }

    // Use transaction to guarantee commit before return
    return withTransaction(async (client) => {
        const result = await client.query(
            `INSERT INTO messages (session_id, role, content, created_at)
             VALUES ($1, $2, $3, now())
             RETURNING id, created_at`,
            [sessionId, role, content]
        );
        return result.rows[0];
    });
}

/**
 * Get all messages for a session with deterministic ordering
 * @param {string} sessionId 
 * @returns {Promise<Array<{id: string, role: string, content: string, created_at: string}>>}
 */
export async function getSessionMessages(sessionId) {
    const result = await query(
        `SELECT id, role, content, created_at
         FROM messages
         WHERE session_id = $1
         ORDER BY created_at ASC, id ASC`,
        [sessionId]
    );
    return result.rows;
}

/**
 * Get message by ID
 * @param {string} messageId 
 * @returns {Promise<{id: string, session_id: string, role: string, content: string, created_at: string} | null>}
 */
export async function getMessageById(messageId) {
    const result = await query(
        `SELECT id, session_id, role, content, created_at
         FROM messages
         WHERE id = $1`,
        [messageId]
    );
    return result.rows[0] || null;
}
