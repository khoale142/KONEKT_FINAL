import 'dotenv/config';
import { query } from '../config/db.js';

async function migrate() {
  console.log('Starting product sizes migration...');

  try {
    await query('BEGIN');

    // Add columns to products
    await query(`
      ALTER TABLE products 
      ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS parent_product_id UUID REFERENCES products(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS size_name TEXT;
    `);
    console.log('Added size columns to products table.');

    // Add columns to ingredients (for preparations that might have sizes)
    await query(`
      ALTER TABLE ingredients 
      ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS parent_ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS size_name TEXT;
    `);
    console.log('Added size columns to ingredients table.');

    await query('COMMIT');
    console.log('Migration completed successfully.');
  } catch (error) {
    await query('ROLLBACK');
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

migrate();
