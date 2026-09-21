import { pool } from '../config/db.js';

async function run() {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`alter table order_items add column if not exists inventory_behavior_snapshot text`);
    await client.query(`alter table order_items add column if not exists inventory_snapshot_version integer`);
    await client.query(`do $$ begin
      if not exists (select 1 from pg_constraint where conname='chk_order_items_inventory_behavior_snapshot') then
        alter table order_items add constraint chk_order_items_inventory_behavior_snapshot
          check (inventory_behavior_snapshot is null or inventory_behavior_snapshot in ('NONE','RECIPE_ON_SALE','STOCKED_PRODUCT'));
      end if;
      if not exists (select 1 from pg_constraint where conname='chk_order_items_inventory_snapshot_version') then
        alter table order_items add constraint chk_order_items_inventory_snapshot_version
          check (inventory_snapshot_version is null or inventory_snapshot_version >= 1);
      end if;
    end $$`);
    await client.query(`create index if not exists idx_order_items_store_inventory_behavior on order_items(store_id,inventory_behavior_snapshot) where inventory_behavior_snapshot is not null`);
    await client.query('commit');
    console.log('Phase 6B order behavior schema completed.');
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    console.error(error.stack || error); process.exitCode = 1;
  } finally { client.release(); await pool.end(); }
}
void run();
