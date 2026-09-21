import { pool } from '../config/db.js';

async function run() { const c=await pool.connect(); try { await c.query('begin');
  await c.query(`create table if not exists inventory_receipt_line_details (
    document_item_id uuid primary key references inventory_document_items(id) on delete restrict,
    entered_quantity numeric not null check(entered_quantity>0), entered_unit_id uuid references inventory_item_units(id) on delete restrict,
    entered_unit_name_snapshot text, conversion_factor_to_base_snapshot numeric check(conversion_factor_to_base_snapshot>0),
    conversion_path_snapshot jsonb, converted_base_quantity numeric check(converted_base_quantity>0), total_purchase_value numeric not null check(total_purchase_value>=0), derived_incoming_unit_cost numeric,
    initial_valuation_applied boolean not null default false, initial_existing_quantity_snapshot numeric, initial_valuation_unit_cost_snapshot numeric, initial_valuation_value_snapshot numeric, resulting_quantity_snapshot numeric,
    resulting_inventory_value_snapshot numeric, resulting_unit_cost_snapshot numeric, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
  )`);
  await c.query(`create index if not exists idx_inventory_receipt_line_details_unit on inventory_receipt_line_details(entered_unit_id)`);
  await c.query('commit'); console.log('Phase 6 schema completed.');
 } catch(e){await c.query('rollback').catch(()=>{});console.error(e.stack||e);process.exitCode=1}finally{c.release();await pool.end()} }
void run();
