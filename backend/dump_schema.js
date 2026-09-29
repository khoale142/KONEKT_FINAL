import fs from 'fs';
import { query, pool } from './src/config/db.js';

async function main() {
  try {
    const columns = await query(`
      SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `);
    fs.writeFileSync('schema_columns.json', JSON.stringify(columns.rows, null, 2));
    console.log('Successfully saved schema_columns.json with', columns.rows.length, 'columns.');
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
