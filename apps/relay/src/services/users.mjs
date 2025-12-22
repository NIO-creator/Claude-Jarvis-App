/**
 * Users Service - User management operations
 * @module services/users
 */

import { query, withTransaction } from '../db-client.mjs';

/**
 * Ensure user exists (upsert by external_id)
 * @param {string} externalId - External user identifier
 * @returns {Promise<{id: string, external_id: string, display_name: string | null}>}
 */
export async function ensureUser(externalId) {
    // Use upsert with ON CONFLICT to ensure deterministic behavior
    const result = await query(
        `INSERT INTO users (external_id)
         VALUES ($1)
         ON CONFLICT (external_id) DO UPDATE SET updated_at = now()
         RETURNING id, external_id, display_name`,
        [externalId]
    );
    return result.rows[0];
}

/**
 * Get user by internal ID
 * @param {string} userId 
 * @returns {Promise<{id: string, external_id: string, display_name: string | null} | null>}
 */
export async function getUserById(userId) {
    const result = await query(
        'SELECT id, external_id, display_name FROM users WHERE id = $1',
        [userId]
    );
    return result.rows[0] || null;
}

/**
 * Get user by external ID
 * @param {string} externalId 
 * @returns {Promise<{id: string, external_id: string, display_name: string | null} | null>}
 */
export async function getUserByExternalId(externalId) {
    const result = await query(
        'SELECT id, external_id, display_name FROM users WHERE external_id = $1',
        [externalId]
    );
    return result.rows[0] || null;
}
