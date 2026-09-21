import { pool } from '../config/db.js';

const SCHEMA = 'public';

async function runMigration() {
  const client = await pool.connect();

  try {
    await client.query('begin');

    await client.query(`
      alter table ${SCHEMA}.order_items
      add column if not exists inventory_snapshot_recorded_at timestamp with time zone
    `);

    await client.query(`
      create table if not exists ${SCHEMA}.order_item_inventory_consumptions (
        id uuid primary key default gen_random_uuid(),
        order_item_id uuid not null
          references ${SCHEMA}.order_items(id) on delete restrict,
        ingredient_id uuid not null
          references ${SCHEMA}.ingredients(id) on delete restrict,
        store_id uuid not null
          references ${SCHEMA}.stores(id) on delete restrict,
        quantity numeric not null,
        created_at timestamp with time zone not null default now(),
        constraint chk_order_item_inventory_consumptions_quantity_positive
          check (quantity > 0),
        constraint uq_order_item_inventory_consumptions_item_ingredient
          unique (order_item_id, ingredient_id)
      )
    `);

    await client.query(`
      create index if not exists idx_order_item_inventory_consumptions_store_item
      on ${SCHEMA}.order_item_inventory_consumptions (store_id, order_item_id)
    `);
    await client.query(`
      create index if not exists idx_order_item_inventory_consumptions_store_ingredient
      on ${SCHEMA}.order_item_inventory_consumptions (store_id, ingredient_id)
    `);

    await client.query(`
      create or replace function ${SCHEMA}.prevent_order_item_inventory_consumption_mutation()
      returns trigger
      language plpgsql
      as $$
      begin
        raise exception 'order_item_inventory_consumptions are immutable';
      end;
      $$
    `);
    await client.query(`
      do $$
      begin
        if not exists (
          select 1
          from pg_trigger trigger_info
          join pg_class table_info on table_info.oid = trigger_info.tgrelid
          join pg_namespace table_namespace on table_namespace.oid = table_info.relnamespace
          where table_namespace.nspname = '${SCHEMA}'
            and table_info.relname = 'order_item_inventory_consumptions'
            and trigger_info.tgname = 'trg_order_item_inventory_consumptions_immutable'
            and not trigger_info.tgisinternal
        ) then
          create trigger trg_order_item_inventory_consumptions_immutable
          before update or delete on ${SCHEMA}.order_item_inventory_consumptions
          for each row execute function ${SCHEMA}.prevent_order_item_inventory_consumption_mutation();
        end if;
      end;
      $$
    `);

    await client.query('commit');
    console.log('Phase 4 inventory consumption snapshot migration completed successfully.');
  } catch (error) {
    await client.query('rollback');
    console.error('Phase 4 inventory consumption snapshot migration failed:', error.stack || error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

void runMigration();
