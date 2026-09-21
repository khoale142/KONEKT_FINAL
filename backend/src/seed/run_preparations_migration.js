import { query, pool } from "../config/db.js";

async function run() {
  console.log("Running Preparations feature database migrations...");
  try {
    console.log("Altering stock_transaction_type enum...");
    try {
      await query(`ALTER TYPE public.stock_transaction_type ADD VALUE IF NOT EXISTS 'PRODUCE_ADD';`);
      console.log("Added 'PRODUCE_ADD' to stock_transaction_type enum.");
    } catch (e) {
      console.log("Note: Failed to add 'PRODUCE_ADD' (might already exist):", e.message);
    }

    try {
      await query(`ALTER TYPE public.stock_transaction_type ADD VALUE IF NOT EXISTS 'PRODUCE_DEDUCT';`);
      console.log("Added 'PRODUCE_DEDUCT' to stock_transaction_type enum.");
    } catch (e) {
      console.log("Note: Failed to add 'PRODUCE_DEDUCT':", e.message);
    }

    console.log("Altering ingredients table...");
    await query(`
      ALTER TABLE public.ingredients 
        ADD COLUMN IF NOT EXISTS is_preparation BOOLEAN NOT NULL DEFAULT FALSE;
    `);

    console.log("Altering recipes table...");
    await query(`
      ALTER TABLE public.recipes 
        ADD COLUMN IF NOT EXISTS ingredient_id UUID REFERENCES public.ingredients(id),
        ADD COLUMN IF NOT EXISTS yield_amount NUMERIC NOT NULL DEFAULT 1;
    `);

    // Make product_id nullable since recipes can now belong to ingredients
    await query(`ALTER TABLE public.recipes ALTER COLUMN product_id DROP NOT NULL;`);

    // Add constraint to ensure either product_id or ingredient_id is set, but not both
    await query(`ALTER TABLE public.recipes DROP CONSTRAINT IF EXISTS recipes_target_check;`);
    await query(`
      ALTER TABLE public.recipes ADD CONSTRAINT recipes_target_check 
      CHECK ((product_id IS NOT NULL AND ingredient_id IS NULL) OR (product_id IS NULL AND ingredient_id IS NOT NULL));
    `);

    console.log("All migrations run successfully.");
  } catch (err) {
    console.error("Migration failed:", err.message || err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void run();
