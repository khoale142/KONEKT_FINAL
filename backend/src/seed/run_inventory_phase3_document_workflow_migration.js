import { pool } from '../config/db.js';

const SCHEMA = 'public';
const TABLES = ['inventory_documents', 'inventory_document_items', 'inventory_document_events', 'inventory_document_sequences'];
const TYPES = ['inventory_document_type', 'inventory_document_status', 'inventory_document_event_type', 'inventory_document_item_role'];
const MARKER = 'KONEKT inventory document workflow phase 3';

async function tableExists(client, name) {
  const result = await client.query(`select to_regclass($1) as relation`, [`${SCHEMA}.${name}`]);
  return Boolean(result.rows[0]?.relation);
}
async function enumExists(client, name) {
  const result = await client.query(`select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname=$1 and t.typtype='e' and t.typname=$2`, [SCHEMA, name]);
  return Boolean(result.rows[0]);
}
async function alreadyApplied(client) {
  if (!await tableExists(client, 'inventory_documents')) return false;
  const marker = await client.query(`select obj_description($1::regclass,'pg_class') as comment`, [`${SCHEMA}.inventory_documents`]);
  if (marker.rows[0]?.comment !== MARKER || !(await enumExists(client, 'inventory_document_type'))) {
    throw new Error('Phase 3 document targets exist without the expected completed marker. Nothing was changed.');
  }
  return true;
}
async function assertFresh(client) {
  const existing = [];
  for (const name of TABLES) if (await tableExists(client, name)) existing.push(name);
  for (const name of TYPES) if (await enumExists(client, name)) existing.push(name);
  if (existing.length) throw new Error(`Phase 3 target objects already exist: ${existing.join(', ')}.`);
}
async function createSchema(client) {
  await client.query(`alter table ${SCHEMA}.stores add constraint uq_stores_tenant_id_id unique (tenant_id,id)`);
  await client.query(`create type ${SCHEMA}.inventory_document_type as enum ('GOODS_RECEIPT','STOCK_COUNT','INVENTORY_ADJUSTMENT','WASTE_LOSS','PREPARATION_PRODUCTION','PRODUCT_PRODUCTION','STORE_TRANSFER','REVERSAL')`);
  await client.query(`create type ${SCHEMA}.inventory_document_status as enum ('DRAFT','PENDING_APPROVAL','REJECTED','APPROVED','CANCELLED','RECEIVED','REVERSED')`);
  await client.query(`create type ${SCHEMA}.inventory_document_event_type as enum ('CREATED','DRAFT_UPDATED','SUBMITTED','REJECTED','CANCELLED','APPROVED','POSTED','RECEIVED','REVERSED')`);
  await client.query(`create type ${SCHEMA}.inventory_document_item_role as enum ('PRIMARY','INPUT','OUTPUT','LOSS')`);
  await client.query(`
    create table ${SCHEMA}.inventory_documents (
      id uuid primary key default gen_random_uuid(), tenant_id uuid not null, store_id uuid not null,
      document_type ${SCHEMA}.inventory_document_type not null, document_number text not null,
      status ${SCHEMA}.inventory_document_status not null default 'DRAFT', revision integer not null default 1,
      created_by uuid not null references ${SCHEMA}.app_users(id) on delete restrict,
      submitted_by uuid references ${SCHEMA}.app_users(id) on delete restrict, submitted_at timestamptz,
      approved_by uuid references ${SCHEMA}.app_users(id) on delete restrict, approved_at timestamptz,
      rejected_by uuid references ${SCHEMA}.app_users(id) on delete restrict, rejected_at timestamptz,
      rejection_reason text, cancelled_by uuid references ${SCHEMA}.app_users(id) on delete restrict, cancelled_at timestamptz,
      posted_at timestamptz, effective_at timestamptz, original_document_id uuid references ${SCHEMA}.inventory_documents(id) on delete restrict,
      note text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
      constraint fk_inventory_documents_store_tenant foreign key (tenant_id,store_id) references ${SCHEMA}.stores(tenant_id,id) on delete restrict,
      constraint chk_inventory_documents_revision check (revision >= 1),
      constraint chk_inventory_documents_original check ((document_type='REVERSAL' and original_document_id is not null) or (document_type<>'REVERSAL' and original_document_id is null)),
      constraint uq_inventory_documents_store_number unique(store_id,document_number),
      constraint uq_inventory_documents_store_id_id unique(store_id,id)
    )`);
  await client.query(`comment on table ${SCHEMA}.inventory_documents is '${MARKER}'`);
  await client.query(`
    create table ${SCHEMA}.inventory_document_items (
      id uuid primary key default gen_random_uuid(), document_id uuid not null, store_id uuid not null, line_number integer not null,
      inventory_item_id uuid not null, item_role ${SCHEMA}.inventory_document_item_role not null default 'PRIMARY',
      base_quantity numeric, unit_cost_snapshot numeric, total_value_snapshot numeric,
      storage_location_name_snapshot text, item_name_snapshot text, base_unit_snapshot text, note text,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
      constraint chk_inventory_document_items_line_number check (line_number > 0),
      constraint fk_inventory_document_items_document_store foreign key (store_id,document_id) references ${SCHEMA}.inventory_documents(store_id,id) on delete restrict,
      constraint fk_inventory_document_items_inventory_store foreign key (store_id,inventory_item_id) references ${SCHEMA}.inventory_items(store_id,id) on delete restrict,
      constraint uq_inventory_document_items_document_line unique(document_id,line_number)
    )`);
  await client.query(`
    create table ${SCHEMA}.inventory_document_events (
      id uuid primary key default gen_random_uuid(), document_id uuid not null references ${SCHEMA}.inventory_documents(id) on delete restrict,
      event_type ${SCHEMA}.inventory_document_event_type not null, actor_id uuid not null references ${SCHEMA}.app_users(id) on delete restrict,
      from_status ${SCHEMA}.inventory_document_status, to_status ${SCHEMA}.inventory_document_status,
      document_revision integer not null, reason text, content_hash text, event_payload jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(), constraint chk_inventory_document_events_revision check(document_revision >= 1)
    )`);
  await client.query(`
    create table ${SCHEMA}.inventory_document_sequences (
      store_id uuid not null references ${SCHEMA}.stores(id) on delete restrict,
      document_type ${SCHEMA}.inventory_document_type not null, next_number bigint not null default 1,
      updated_at timestamptz not null default now(), primary key(store_id,document_type),
      constraint chk_inventory_document_sequences_next check(next_number >= 1)
    )`);
  for (const sql of [
    `create index idx_inventory_documents_store_status_created on ${SCHEMA}.inventory_documents(store_id,status,created_at desc,id desc)`,
    `create index idx_inventory_documents_store_type_created on ${SCHEMA}.inventory_documents(store_id,document_type,created_at desc,id desc)`,
    `create index idx_inventory_documents_creator on ${SCHEMA}.inventory_documents(created_by,created_at desc)`,
    `create index idx_inventory_documents_approver on ${SCHEMA}.inventory_documents(approved_by,approved_at desc) where approved_by is not null`,
    `create index idx_inventory_documents_original on ${SCHEMA}.inventory_documents(original_document_id) where original_document_id is not null`,
    `create index idx_inventory_document_events_document_created on ${SCHEMA}.inventory_document_events(document_id,created_at,id)`,
    `create index idx_inventory_document_items_document_line on ${SCHEMA}.inventory_document_items(document_id,line_number)`,
  ]) await client.query(sql);
  await client.query(`create function ${SCHEMA}.prevent_inventory_document_event_mutation() returns trigger language plpgsql as $$ begin raise exception 'inventory_document_events are immutable'; end; $$`);
  await client.query(`create trigger trg_inventory_document_events_immutable before update or delete on ${SCHEMA}.inventory_document_events for each row execute function ${SCHEMA}.prevent_inventory_document_event_mutation()`);
}
async function run() { const client=await pool.connect(); try { await client.query('begin'); await client.query(`set local search_path=${SCHEMA},pg_catalog`); if(await alreadyApplied(client)){await client.query('commit');console.log('Phase 3 already applied.');return;} await assertFresh(client); await createSchema(client); await client.query('commit'); console.log('Phase 3 document workflow migration completed.'); } catch(error){await client.query('rollback').catch(()=>undefined);console.error('Phase 3 migration failed; transaction rolled back:',error.stack||error);process.exitCode=1;} finally {client.release();await pool.end();} }
void run();
