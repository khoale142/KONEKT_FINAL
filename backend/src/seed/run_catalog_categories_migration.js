import 'dotenv/config';
import { pool } from '../config/db.js';

async function runMigration() {
  const client = await pool.connect();

  try {
    await client.query('begin');
    console.log('Starting catalog categories migration...');

    await client.query(`
      create table if not exists categories (
        id uuid primary key default gen_random_uuid(),
        store_id uuid not null references stores(id) on delete cascade,
        name varchar(80) not null,
        scope varchar(20) not null check (scope in ('PRODUCT', 'INGREDIENT', 'BOTH')),
        created_by uuid references app_users(id) on delete set null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        deleted_at timestamptz
      )
    `);

    await client.query(`
      alter table products add column if not exists category_id uuid;
      alter table products add column if not exists image_url text;
      alter table ingredients add column if not exists category_id uuid;
      alter table products alter column tag drop not null;
      alter table ingredients alter column tag drop not null;
    `);

    await client.query(`
      do $$
      begin
        if not exists (select 1 from pg_constraint where conname = 'fk_products_category') then
          alter table products add constraint fk_products_category
            foreign key (category_id) references categories(id) on delete set null;
        end if;
        if not exists (select 1 from pg_constraint where conname = 'fk_ingredients_category') then
          alter table ingredients add constraint fk_ingredients_category
            foreign key (category_id) references categories(id) on delete set null;
        end if;
      end $$;
    `);

    await client.query(`
      create unique index if not exists uq_categories_store_name_active
        on categories (store_id, lower(name)) where deleted_at is null;
      create index if not exists idx_categories_store_scope
        on categories (store_id, scope) where deleted_at is null;
      create index if not exists idx_products_category_id on products(category_id);
      create index if not exists idx_ingredients_category_id on ingredients(category_id);
    `);

    await client.query('commit');
    console.log('Catalog categories migration completed successfully.');
  } catch (error) {
    await client.query('rollback');
    console.error('Catalog categories migration failed:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

void runMigration();
