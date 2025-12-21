import pg from 'pg';
import { logger } from './logger.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
    if (!pool) {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) {
            logger.warn('DATABASE_URL not set, database features disabled');
            throw new Error('DATABASE_URL not configured');
        }
        pool = new Pool({ connectionString });
    }
    return pool;
}

export async function checkDatabase(): Promise<boolean> {
    try {
        const client = getPool();
        const result = await client.query('SELECT 1 as health');
        return result.rows[0]?.health === 1;
    } catch (err) {
        logger.error({ err }, 'Database health check failed');
        return false;
    }
}

export async function query<T>(sql: string, params?: unknown[]): Promise<T[]> {
    const client = getPool();
    const result = await client.query(sql, params);
    return result.rows as T[];
}
