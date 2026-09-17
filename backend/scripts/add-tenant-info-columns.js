import 'dotenv/config';
import { pool } from '../src/config/db.js';

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    console.log('Adding email, phone, address to tenants...');
    
    // Check if columns already exist
    const checkQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='tenants' and column_name='email';
    `;
    const res = await client.query(checkQuery);
    
    if (res.rows.length === 0) {
      await client.query(`
        ALTER TABLE tenants 
        ADD COLUMN email VARCHAR(120),
        ADD COLUMN phone VARCHAR(20),
        ADD COLUMN address TEXT;
      `);
      console.log('Columns added successfully.');
    } else {
      console.log('Columns already exist.');
    }
    
    await client.query('COMMIT');
    console.log('Migration completed.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
