// Migration runner - applies SQL migrations using DATABASE_URL
import pg from 'pg';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function runMigrations() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.error('DATABASE_URL not set');
        process.exit(1);
    }

    const pool = new pg.Pool({ connectionString });
    
    try {
        console.log('Connecting to database...');
        const client = await pool.connect();
        
        try {
            // Read and execute migration file
            const migrationPath = join(__dirname, 'migrations', '001_init.sql');
            const migrationSQL = readFileSync(migrationPath, 'utf8');
            
            console.log('Applying migration 001_init.sql...');
            await client.query(migrationSQL);
            console.log('Migration applied successfully!');
            
            // Verify tables were created
            const result = await client.query(`
                SELECT tablename FROM pg_tables 
                WHERE schemaname = 'public' 
                ORDER BY tablename
            `);
            
            console.log('Tables in database:');
            result.rows.forEach(row => console.log(`  - ${row.tablename}`));
            
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigrations();
