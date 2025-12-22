/**
 * Sessions Service - Session lifecycle management
 * @module services/sessions
 */

import { query, withTransaction } from '../db-client.mjs';

/**
 * Create a new session for a user
 * @param {string} userId - Internal user UUID
 * @returns {Promise<{id: string, started_at: string}>}
 */
export async function createSession(userId) {
    // Use transaction to ensure commit before return
    return withTransaction(async (client) => {
        const result = await client.query(
            `INSERT INTO sessions (user_id, started_at)
             VALUES ($1, now())
             RETURNING id, started_at`,
            [userId]
        );
        return result.rows[0];
    });
}

/**
 * End a session by setting ended_at timestamp
 * @param {string} sessionId 
 * @returns {Promise<{id: string, ended_at: string}>}
 */
export async function endSession(sessionId) {
    // Use transaction to ensure commit before return
    return withTransaction(async (client) => {
        const result = await client.query(
            `UPDATE sessions 
             SET ended_at = now()
             WHERE id = $1
             RETURNING id, ended_at`,
            [sessionId]
        );
        if (!result.rows[0]) {
            throw new Error(`Session not found: ${sessionId}`);
        }
        return result.rows[0];
    });
}

/**
 * Get the last session for a user
 * Priority: ended sessions first (most recent), then current active session
 * Ensures deterministic ordering by ended_at DESC, then started_at DESC, then id
 * @param {string} userId 
 * @returns {Promise<{id: string, started_at: string, ended_at: string | null} | null>}
 */
export async function getLastSessionId(userId) {
    const result = await query(
        `SELECT id, started_at, ended_at
         FROM sessions
         WHERE user_id = $1
         ORDER BY 
           CASE WHEN ended_at IS NOT NULL THEN 0 ELSE 1 END,
           ended_at DESC NULLS LAST,
           started_at DESC,
           id DESC
         LIMIT 1`,
        [userId]
    );
    return result.rows[0] || null;
}

/**
 * Get the last ENDED session for a user (ignores active sessions)
 * @param {string} userId 
 * @returns {Promise<{id: string, started_at: string, ended_at: string} | null>}
 */
export async function getLastEndedSession(userId) {
    const result = await query(
        `SELECT id, started_at, ended_at
         FROM sessions
         WHERE user_id = $1 AND ended_at IS NOT NULL
         ORDER BY ended_at DESC, started_at DESC, id DESC
         LIMIT 1`,
        [userId]
    );
    return result.rows[0] || null;
}

/**
 * Get current active session for a user
 * @param {string} userId 
 * @returns {Promise<{id: string, started_at: string} | null>}
 */
export async function getActiveSession(userId) {
    const result = await query(
        `SELECT id, started_at
         FROM sessions
         WHERE user_id = $1 AND ended_at IS NULL
         ORDER BY started_at DESC, id DESC
         LIMIT 1`,
        [userId]
    );
    return result.rows[0] || null;
}

/**
 * Get session by ID
 * @param {string} sessionId 
 * @returns {Promise<{id: string, user_id: string, started_at: string, ended_at: string | null} | null>}
 */
export async function getSessionById(sessionId) {
    const result = await query(
        `SELECT id, user_id, started_at, ended_at
         FROM sessions
         WHERE id = $1`,
        [sessionId]
    );
    return result.rows[0] || null;
}
