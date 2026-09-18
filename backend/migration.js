import { pool } from './src/config/db.js';

async function run() {
  try {
    await pool.query("ALTER TABLE store_staff ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'STAFF'");
    console.log('Migration successful');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
