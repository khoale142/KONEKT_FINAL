import { pool } from '../config/db.js';

const SCHEMA = 'public';
const MOVEMENT_TABLE = 'inventory_movements';
const MOVEMENT_TYPE = 'inventory_movement_type';
const MOVEMENT_COMMENT = 'KONEKT inventory movement ledger phase 2';

async function relationExists(client, relationName) {
  const result = await client.query(
    `select to_regclass($1) as relation`,
    [`${SCHEMA}.${relationName}`],
  );
  return Boolean(result.rows[0]?.relation);
}

async function enumExists(client, enumName) {
  const result = await client.query(`
    select 1
    from pg_type type_info
    join pg_namespace namespace_info on namespace_info.oid = type_info.typnamespace
    where namespace_info.nspname = $1
      and type_info.typtype = 'e'
      and type_info.typname = $2`, [SCHEMA, enumName]);
  return Boolean(result.rows[0]);
}

async function requirePhase1Foundation(client) {
  const requiredTables = ['inventory_items', 'app_users'];
  const missing = [];
  for (const tableName of requiredTables) {
    if (!await relationExists(client, tableName)) missing.push(tableName);
  }
  if (missing.length) {
    throw new Error(`Phase 2 requires Phase 1 foundation table(s): ${missing.join(', ')}.`);
  }
}

async function isAlreadyApplied(client) {
  if (!await relationExists(client, MOVEMENT_TABLE)) return false;

  const marker = await client.query(
    `select obj_description($1::regclass, 'pg_class') as comment`,
    [`${SCHEMA}.${MOVEMENT_TABLE}`],
  );
  if (marker.rows[0]?.comment !== MOVEMENT_COMMENT) {
    throw new Error('inventory_movements already exists without the expected Phase 2 marker. Review its provenance before proceeding.');
  }
  if (!await enumExists(client, MOVEMENT_TYPE)) {
    throw new Error('inventory_movements exists but inventory_movement_type is missing. Resolve the partial schema manually.');
  }

  return true;
}

async function assertFreshTargets(client) {
  const movementTableExists = await relationExists(client, MOVEMENT_TABLE);
  const movementTypeExists = await enumExists(client, MOVEMENT_TYPE);
  if (movementTableExists || movementTypeExists) {
    throw new Error('Phase 2 target objects already exist without a completed Phase 2 marker. Nothing was changed.');
  }
}

async function createLedger(client) {
  await client.query(`
    create type ${SCHEMA}.${MOVEMENT_TYPE} as enum (
      'RECEIPT_IN',
      'SALE_OUT',
      'REFUND_IN',
      'COUNT_ADJUST',
      'MANUAL_ADJUST',
      'WASTE_OUT',
      'PRODUCTION_INPUT',
      'PRODUCTION_OUTPUT',
      'TRANSFER_OUT',
      'TRANSFER_IN',
      'REVERSAL'
    )
  `);

  await client.query(`
    create table ${SCHEMA}.${MOVEMENT_TABLE} (
      id uuid primary key default gen_random_uuid(),
      store_id uuid not null references ${SCHEMA}.stores(id) on delete restrict,
      inventory_item_id uuid not null,
      document_id uuid,
      document_item_id uuid,
      order_id uuid,
      order_item_id uuid,
      movement_type ${SCHEMA}.${MOVEMENT_TYPE} not null,
      quantity_delta numeric not null,
      before_quantity numeric not null,
      after_quantity numeric not null,
      unit_cost_snapshot numeric,
      value_delta numeric,
      reversal_of_movement_id uuid references ${SCHEMA}.${MOVEMENT_TABLE}(id) on delete restrict,
      posting_key text not null,
      posted_by uuid not null references ${SCHEMA}.app_users(id) on delete restrict,
      occurred_at timestamp with time zone not null,
      created_at timestamp with time zone not null default now(),
      metadata jsonb not null default '{}'::jsonb,
      constraint chk_inventory_movements_quantity_nonzero check (quantity_delta <> 0),
      constraint chk_inventory_movements_quantity_math check (after_quantity = before_quantity + quantity_delta),
      constraint chk_inventory_movements_unit_cost_nonnegative check (
        unit_cost_snapshot is null or unit_cost_snapshot >= 0
      ),
      constraint chk_inventory_movements_reversal_not_self check (
        reversal_of_movement_id is null or reversal_of_movement_id <> id
      ),
      constraint fk_inventory_movements_inventory_item_store
        foreign key (store_id, inventory_item_id)
        references ${SCHEMA}.inventory_items(store_id, id) on delete restrict,
      constraint uq_inventory_movements_posting_key unique (posting_key)
    )
  `);
  await client.query(`comment on table ${SCHEMA}.${MOVEMENT_TABLE} is '${MOVEMENT_COMMENT}'`);

  await client.query(`
    create unique index uq_inventory_movements_one_reversal_per_original
    on ${SCHEMA}.${MOVEMENT_TABLE}(reversal_of_movement_id)
    where reversal_of_movement_id is not null
  `);
  await client.query(`
    create index idx_inventory_movements_store_occurred
    on ${SCHEMA}.${MOVEMENT_TABLE}(store_id, occurred_at desc, id desc)
  `);
  await client.query(`
    create index idx_inventory_movements_store_item_occurred
    on ${SCHEMA}.${MOVEMENT_TABLE}(store_id, inventory_item_id, occurred_at desc, id desc)
  `);
  await client.query(`
    create index idx_inventory_movements_store_type_occurred
    on ${SCHEMA}.${MOVEMENT_TABLE}(store_id, movement_type, occurred_at desc, id desc)
  `);
  await client.query(`
    create index idx_inventory_movements_order_item
    on ${SCHEMA}.${MOVEMENT_TABLE}(order_item_id)
    where order_item_id is not null
  `);
  await client.query(`
    create index idx_inventory_movements_store_order
    on ${SCHEMA}.${MOVEMENT_TABLE}(store_id, order_id, occurred_at desc, id desc)
    where order_id is not null
  `);

  await client.query(`
    create function ${SCHEMA}.prevent_inventory_movement_mutation()
    returns trigger
    language plpgsql
    as $$
    begin
      raise exception 'inventory_movements are immutable';
    end;
    $$
  `);
  await client.query(`
    create trigger trg_inventory_movements_immutable
    before update or delete on ${SCHEMA}.${MOVEMENT_TABLE}
    for each row execute function ${SCHEMA}.prevent_inventory_movement_mutation()
  `);
}

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`set local search_path = ${SCHEMA}, pg_catalog`);
    await requirePhase1Foundation(client);

    if (await isAlreadyApplied(client)) {
      await client.query('commit');
      console.log('Inventory Phase 2 movement-ledger migration was already applied; no changes made.');
      return;
    }

    await assertFreshTargets(client);
    await createLedger(client);
    await client.query('commit');
    console.log('Inventory Phase 2 movement-ledger migration completed successfully.');
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    console.error('Inventory Phase 2 movement-ledger migration failed; transaction rolled back:', error.stack || error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

void runMigration();
