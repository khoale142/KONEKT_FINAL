import 'dotenv/config';
import { pool, query } from '../config/db.js';

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('begin');
    console.log('Starting multi-tenant database migration...');

    // 1. Create tenants table
    console.log('Creating tenants table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(120) NOT NULL,
        slug VARCHAR(120) UNIQUE,
        email VARCHAR(120),
        phone VARCHAR(20),
        address TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      ALTER TABLE tenants
      ADD COLUMN IF NOT EXISTS email VARCHAR(120),
      ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
      ADD COLUMN IF NOT EXISTS address TEXT
    `);

    // 2. Create stores table
    console.log('Creating stores table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS stores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(120) NOT NULL,
        address TEXT,
        invite_code VARCHAR(20) UNIQUE NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // 3. Create tenant_owners table
    console.log('Creating tenant_owners table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenant_owners (
        user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, tenant_id)
      )
    `);

    // 4. Create store_staff table
    console.log('Creating store_staff table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS store_staff (
        user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
        store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL DEFAULT 'STAFF' CHECK (role IN ('MANAGER','STAFF')),
        joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, store_id)
      )
    `);

    // 5. Add store_id to all business tables
    console.log('Adding store_id to business tables...');
    const tablesToUpdate = [
      'products', 'ingredients', 'recipes', 'orders', 'order_items', 
      'stock_transactions', 'pos_sessions', 'shifts', 'staff_shifts', 
      'staff_availability', 'staff_requests'
    ];

    for (const table of tablesToUpdate) {
      const checkColumn = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name=$1 and column_name='store_id';
      `, [table]);

      if (checkColumn.rows.length === 0) {
        await client.query(`ALTER TABLE ${table} ADD COLUMN store_id UUID REFERENCES stores(id) ON DELETE CASCADE`);
        console.log(`Added store_id to ${table}`);
      }
    }

    // 6. Recreate views to include store_id
    console.log('Recreating views...');
    await client.query(`
      DROP VIEW IF EXISTS v_daily_revenue;
      CREATE VIEW v_daily_revenue AS
        SELECT o.store_id,
               o.created_at::date AS order_date,
               COUNT(*)::int AS total_orders,
               SUM(o.total_amount) AS total_revenue,
               SUM(COALESCE(o.refunded_amount, 0)) AS total_refunded
        FROM orders o
        WHERE o.status IN ('SUCCESS','PARTIALLY_REFUNDED','REFUNDED')
        GROUP BY o.store_id, o.created_at::date;

      DROP VIEW IF EXISTS v_best_selling_products;
      CREATE VIEW v_best_selling_products AS
        SELECT p.store_id,
               p.id AS product_id,
               p.name AS product_name,
               p.price,
               SUM(oi.quantity)::int AS total_quantity_sold,
               SUM(oi.subtotal) AS total_revenue
        FROM products p
        JOIN order_items oi ON p.id = oi.product_id
        JOIN orders o ON o.id = oi.order_id
        WHERE o.status = 'SUCCESS'
        GROUP BY p.store_id, p.id, p.name, p.price;

      DROP VIEW IF EXISTS v_low_stock_ingredients;
      CREATE VIEW v_low_stock_ingredients AS
        SELECT store_id,
               id AS ingredient_id,
               name AS ingredient_name,
               unit,
               current_stock,
               low_stock_threshold
        FROM ingredients
        WHERE deleted_at IS NULL
          AND current_stock <= low_stock_threshold;
    `);

    // 7. Create indexes for performance
    console.log('Creating indexes...');
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_stores_tenant_id ON stores(tenant_id)',
      'CREATE INDEX IF NOT EXISTS idx_stores_invite_code ON stores(invite_code)',
      'CREATE INDEX IF NOT EXISTS idx_tenant_owners_user ON tenant_owners(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_store_staff_user ON store_staff(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_id)',
      'CREATE INDEX IF NOT EXISTS idx_ingredients_store ON ingredients(store_id)',
      'CREATE INDEX IF NOT EXISTS idx_orders_store ON orders(store_id)',
      'CREATE INDEX IF NOT EXISTS idx_pos_sessions_store ON pos_sessions(store_id)',
      'CREATE INDEX IF NOT EXISTS idx_stock_transactions_store ON stock_transactions(store_id)',
      'CREATE INDEX IF NOT EXISTS idx_shifts_store ON shifts(store_id)',
      'CREATE INDEX IF NOT EXISTS idx_staff_shifts_store ON staff_shifts(store_id)',
    ];

    for (const idx of indexes) {
      await client.query(idx);
    }

    // 7. Update unique constraints (remove old, create new with store_id)
    console.log('Updating unique constraints for products and ingredients...');
    
    // Drop old unique indexes if they exist
    await client.query(`DROP INDEX IF EXISTS uq_products_name`);
    await client.query(`DROP INDEX IF EXISTS uq_ingredients_name_unit`);

    // Create new unique indexes
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_products_name_store 
      ON products (lower(name), store_id) WHERE deleted_at IS NULL
    `);
    
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_ingredients_name_unit_store 
      ON ingredients (lower(name), unit, store_id) WHERE deleted_at IS NULL
    `);

    await client.query('commit');
    console.log('Migration completed successfully.');
  } catch (error) {
    await client.query('rollback');
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

runMigration();
