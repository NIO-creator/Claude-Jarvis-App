/**
 * Enhanced Database Client with Transaction Support
 * @module db-client
 */

import pg from 'pg';

const { Pool } = pg;

let pool = null;

/**
 * Get the database connection pool
 * @returns {pg.Pool}
 */
function getPool() {
    if (!pool) {
        const connectionString = process.env.DATABASE_URL || process.env.DATABASE_URL_MVP;
        if (!connectionString) {
            throw new Error('DATABASE_URL not configured');
        }
        pool = new Pool({
            connectionString,
            // Ensure connections are properly managed
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
        });
    }
    return pool;
}

/**
 * Execute a simple query
 * @param {string} sql 
 * @param {any[]} params 
 * @returns {Promise<pg.QueryResult>}
 */
export async function query(sql, params = []) {
    const client = getPool();
    return client.query(sql, params);
}

/**
 * Get a dedicated client for transaction work
 * @returns {Promise<pg.PoolClient>}
 */
export async function getClient() {
    return getPool().connect();
}

/**
 * Execute a function within a transaction with commit guarantee
 * @template T
 * @param {(client: pg.PoolClient) => Promise<T>} fn 
 * @returns {Promise<T>}
 */
export async function withTransaction(fn) {
    const client = await getClient();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Check database health
 * @returns {Promise<boolean>}
 */
export async function checkDatabase() {
    try {
        const result = await query('SELECT 1 as health');
        return result.rows[0]?.health === 1;
    } catch (err) {
        console.error('Database health check failed:', err.message);
        return false;
    }
}

export { getPool };
