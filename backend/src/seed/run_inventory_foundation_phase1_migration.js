import { pool } from '../config/db.js';

const SCHEMA = 'public';
const FOUNDATION_COMMENT = 'KONEKT inventory foundation phase 1';
const FOUNDATION_TABLES = ['storage_locations', 'inventory_items', 'inventory_item_units'];
const FOUNDATION_TYPES = [
  'inventory_item_type',
  'inventory_product_inventory_mode',
  'inventory_cost_method',
  'inventory_cost_status',
];

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

async function objectRows(client, relkind, names) {
  const result = await client.query(`
    select c.relname as name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = $1 and c.relkind = $2 and c.relname = any($3::text[])
    order by c.relname`, [SCHEMA, relkind, names]);
  return result.rows.map((row) => row.name);
}

async function enumRows(client, names) {
  const result = await client.query(`
    select t.typname as name
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = $1 and t.typtype = 'e' and t.typname = any($2::text[])
    order by t.typname`, [SCHEMA, names]);
  return result.rows.map((row) => row.name);
}

async function requireBaseTables(client) {
  const result = await client.query(`
    select table_name
    from information_schema.tables
    where table_schema = $1
      and table_name = any($2::text[])`, [SCHEMA, ['stores', 'ingredients', 'products', 'app_users']]);
  const found = new Set(result.rows.map((row) => row.table_name));
  const missing = ['stores', 'ingredients', 'products', 'app_users'].filter((table) => !found.has(table));
  if (missing.length) {
    throw new Error(`Required base table(s) missing: ${missing.join(', ')}.`);
  }
}

async function isAlreadyApplied(client) {
  const tables = await objectRows(client, 'r', FOUNDATION_TABLES);
  if (tables.length === 0) return false;
  if (tables.length !== FOUNDATION_TABLES.length) {
    throw new Error(`Partial inventory foundation tables found (${tables.join(', ')}). Resolve manually; this migration will not guess how to repair them.`);
  }

  const marker = await client.query(
    `select obj_description($1::regclass, 'pg_class') as comment`,
    [`${SCHEMA}.inventory_items`],
  );
  if (marker.rows[0]?.comment !== FOUNDATION_COMMENT) {
    throw new Error('Inventory foundation tables already exist without the expected Phase 1 marker. Review provenance before proceeding.');
  }

  return true;
}

async function assertFreshTargetObjects(client) {
  const tables = await objectRows(client, 'r', FOUNDATION_TABLES);
  const enums = await enumRows(client, FOUNDATION_TYPES);
  if (tables.length || enums.length) {
    throw new Error(
      `Target inventory foundation objects already exist: ${[...tables, ...enums].join(', ')}. Run the read-only preflight and review provenance instead of overwriting them.`,
    );
  }
}

async function ensureNegativeStockPolicyMarker(client) {
  const result = await client.query(`
    select data_type, udt_schema, udt_name
    from information_schema.columns
    where table_schema = $1 and table_name = 'stores'
      and column_name = 'negative_stock_policy_configured_at'`, [SCHEMA]);
  const existing = result.rows[0];

  if (!existing) {
    await client.query(`
      alter table ${SCHEMA}.stores
      add column negative_stock_policy_configured_at timestamp with time zone
    `);
    return;
  }

  if (existing.data_type !== 'timestamp with time zone') {
    throw new Error(
      `stores.negative_stock_policy_configured_at has unsupported type ${existing.data_type} (${existing.udt_schema}.${existing.udt_name}).`,
    );
  }
}

async function createFoundationTypes(client) {
  await client.query(`create type ${SCHEMA}.inventory_item_type as enum ('RAW_INGREDIENT', 'PREPARATION', 'PRODUCT')`);
  await client.query(`create type ${SCHEMA}.inventory_product_inventory_mode as enum ('RECIPE_ON_SALE', 'STOCKED')`);
  await client.query(`create type ${SCHEMA}.inventory_cost_method as enum ('WAC')`);
  await client.query(`create type ${SCHEMA}.inventory_cost_status as enum ('UNAVAILABLE', 'AVAILABLE', 'STALE')`);
}

async function createFoundationTables(client) {
  // Composite foreign keys keep catalog and organizational-location ownership in the same Store.
  // The added pair constraints do not change legacy behavior and do not infer ownership.
  await client.query(`
    alter table ${SCHEMA}.ingredients
    add constraint uq_ingredients_store_id_id unique (store_id, id)
  `);
  await client.query(`
    alter table ${SCHEMA}.products
    add constraint uq_products_store_id_id unique (store_id, id)
  `);

  await client.query(`
    create table ${SCHEMA}.storage_locations (
      id uuid primary key default gen_random_uuid(),
      store_id uuid not null references ${SCHEMA}.stores(id) on delete restrict,
      code text,
      name text not null,
      description text,
      sort_order integer not null default 0,
      is_active boolean not null default true,
      created_by uuid references ${SCHEMA}.app_users(id) on delete set null,
      created_at timestamp with time zone not null default now(),
      updated_at timestamp with time zone not null default now(),
      constraint chk_storage_locations_name_nonblank check (length(btrim(name)) > 0),
      constraint uq_storage_locations_store_id_id unique (store_id, id)
    )
  `);
  await client.query(`
    create unique index uq_storage_locations_active_store_name
    on ${SCHEMA}.storage_locations (store_id, lower(btrim(name)))
    where is_active
  `);
  await client.query(`
    create index idx_storage_locations_store_active_sort
    on ${SCHEMA}.storage_locations (store_id, is_active, sort_order, name)
  `);

  await client.query(`
    create table ${SCHEMA}.inventory_items (
      id uuid primary key default gen_random_uuid(),
      store_id uuid not null references ${SCHEMA}.stores(id) on delete restrict,
      item_type ${SCHEMA}.inventory_item_type not null,
      ingredient_id uuid,
      product_id uuid,
      quantity_on_hand numeric not null default 0,
      inventory_value numeric,
      current_unit_cost numeric,
      cost_method ${SCHEMA}.inventory_cost_method not null default 'WAC',
      cost_status ${SCHEMA}.inventory_cost_status not null default 'UNAVAILABLE',
      cost_version integer not null default 0,
      low_stock_threshold numeric,
      storage_location_id uuid,
      stock_activated_at timestamp with time zone,
      row_version bigint not null default 0,
      product_inventory_mode ${SCHEMA}.inventory_product_inventory_mode,
      created_at timestamp with time zone not null default now(),
      updated_at timestamp with time zone not null default now(),
      constraint chk_inventory_items_catalog_target check (
        (item_type in ('RAW_INGREDIENT', 'PREPARATION') and ingredient_id is not null and product_id is null)
        or (item_type = 'PRODUCT' and ingredient_id is null and product_id is not null)
      ),
      constraint chk_inventory_items_product_mode check (
        (item_type = 'PRODUCT' and product_inventory_mode is not null)
        or (item_type <> 'PRODUCT' and product_inventory_mode is null)
      ),
      constraint chk_inventory_items_threshold_nonnegative check (
        low_stock_threshold is null or low_stock_threshold >= 0
      ),
      constraint chk_inventory_items_cost_version_nonnegative check (cost_version >= 0),
      constraint chk_inventory_items_row_version_nonnegative check (row_version >= 0),
      constraint fk_inventory_items_ingredient_store
        foreign key (store_id, ingredient_id)
        references ${SCHEMA}.ingredients(store_id, id) on delete restrict,
      constraint fk_inventory_items_product_store
        foreign key (store_id, product_id)
        references ${SCHEMA}.products(store_id, id) on delete restrict,
      constraint fk_inventory_items_storage_location_store
        foreign key (store_id, storage_location_id)
        references ${SCHEMA}.storage_locations(store_id, id) on delete restrict,
      constraint uq_inventory_items_store_ingredient unique (store_id, ingredient_id),
      constraint uq_inventory_items_store_product unique (store_id, product_id),
      constraint uq_inventory_items_store_id_id unique (store_id, id)
    )
  `);
  await client.query(`comment on table ${SCHEMA}.inventory_items is '${FOUNDATION_COMMENT}'`);
  await client.query(`
    create index idx_inventory_items_store_type
    on ${SCHEMA}.inventory_items (store_id, item_type)
  `);
  await client.query(`
    create index idx_inventory_items_store_location
    on ${SCHEMA}.inventory_items (store_id, storage_location_id)
    where storage_location_id is not null
  `);
  await client.query(`
    create index idx_inventory_items_store_low_stock
    on ${SCHEMA}.inventory_items (store_id, low_stock_threshold)
    where low_stock_threshold is not null
  `);

  await client.query(`
    create table ${SCHEMA}.inventory_item_units (
      id uuid primary key default gen_random_uuid(),
      inventory_item_id uuid not null
        references ${SCHEMA}.inventory_items(id) on delete restrict,
      name text not null,
      symbol text,
      level smallint not null,
      is_base boolean not null default false,
      parent_unit_id uuid,
      multiplier_to_parent numeric not null,
      factor_to_base numeric not null,
      is_active boolean not null default true,
      created_at timestamp with time zone not null default now(),
      updated_at timestamp with time zone not null default now(),
      constraint chk_inventory_item_units_name_nonblank check (length(btrim(name)) > 0),
      constraint chk_inventory_item_units_level_range check (level between 0 and 2),
      constraint chk_inventory_item_units_positive_factors check (
        multiplier_to_parent > 0 and factor_to_base > 0
      ),
      constraint chk_inventory_item_units_base_shape check (
        (is_base and level = 0 and parent_unit_id is null and multiplier_to_parent = 1 and factor_to_base = 1)
        or (not is_base and level in (1, 2) and parent_unit_id is not null)
      ),
      constraint chk_inventory_item_units_not_own_parent check (parent_unit_id is null or parent_unit_id <> id),
      constraint uq_inventory_item_units_item_id_id unique (inventory_item_id, id),
      constraint fk_inventory_item_units_parent_same_item
        foreign key (inventory_item_id, parent_unit_id)
        references ${SCHEMA}.inventory_item_units(inventory_item_id, id)
        deferrable initially immediate
    )
  `);
  await client.query(`
    create unique index uq_inventory_item_units_one_base
    on ${SCHEMA}.inventory_item_units (inventory_item_id)
    where is_base
  `);
  await client.query(`
    create unique index uq_inventory_item_units_active_name
    on ${SCHEMA}.inventory_item_units (inventory_item_id, lower(btrim(name)))
    where is_active
  `);
  await client.query(`
    create index idx_inventory_item_units_item_level
    on ${SCHEMA}.inventory_item_units (inventory_item_id, level, is_active)
  `);
}

async function createUnitHierarchyGuard(client) {
  // A recursive relationship cannot be expressed by a plain CHECK constraint. This compact
  // guard only protects structural unit hierarchy invariants; it carries no voucher business logic.
  await client.query(`
    create function ${SCHEMA}.validate_inventory_item_unit_hierarchy()
    returns trigger
    language plpgsql
    as $$
    declare
      parent_row record;
    begin
      if new.is_base then
        return new;
      end if;

      select id, level, factor_to_base
      into parent_row
      from ${SCHEMA}.inventory_item_units
      where id = new.parent_unit_id
        and inventory_item_id = new.inventory_item_id;

      if not found then
        raise exception 'Inventory unit parent must belong to the same inventory item';
      end if;

      if parent_row.level <> new.level - 1 then
        raise exception 'Inventory unit parent level must be exactly one level lower';
      end if;

      if new.factor_to_base <> parent_row.factor_to_base * new.multiplier_to_parent then
        raise exception 'Inventory unit factor_to_base must equal parent factor times multiplier_to_parent';
      end if;

      if exists (
        with recursive ancestors as (
          select id, parent_unit_id
          from ${SCHEMA}.inventory_item_units
          where id = new.parent_unit_id
            and inventory_item_id = new.inventory_item_id
          union all
          select unit.id, unit.parent_unit_id
          from ${SCHEMA}.inventory_item_units unit
          join ancestors ancestor on ancestor.parent_unit_id = unit.id
          where unit.inventory_item_id = new.inventory_item_id
        )
        select 1 from ancestors where id = new.id
      ) then
        raise exception 'Inventory unit hierarchy cannot contain a cycle';
      end if;

      return new;
    end;
    $$
  `);
  await client.query(`
    create trigger trg_inventory_item_units_validate_hierarchy
    before insert or update of inventory_item_id, level, is_base, parent_unit_id, multiplier_to_parent, factor_to_base
    on ${SCHEMA}.inventory_item_units
    for each row execute function ${SCHEMA}.validate_inventory_item_unit_hierarchy()
  `);
}

async function backfillFoundation(client) {
  const ingredientItems = await client.query(`
    insert into ${SCHEMA}.inventory_items (
      store_id, item_type, ingredient_id, quantity_on_hand, low_stock_threshold
    )
    select i.store_id,
           case when i.is_preparation then 'PREPARATION'::${SCHEMA}.inventory_item_type
                else 'RAW_INGREDIENT'::${SCHEMA}.inventory_item_type end,
           i.id,
           i.current_stock,
           i.low_stock_threshold
    from ${SCHEMA}.ingredients i
    where i.deleted_at is null
      and i.store_id is not null
    returning id
  `);

  const productItems = await client.query(`
    insert into ${SCHEMA}.inventory_items (
      store_id, item_type, product_id, quantity_on_hand, product_inventory_mode
    )
    select p.store_id,
           'PRODUCT'::${SCHEMA}.inventory_item_type,
           p.id,
           0,
           'RECIPE_ON_SALE'::${SCHEMA}.inventory_product_inventory_mode
    from ${SCHEMA}.products p
    where p.deleted_at is null
      and p.store_id is not null
      and p.status = 'ACTIVE'
      and (p.parent_product_id is not null or not coalesce(p.is_group, false))
    returning id
  `);

  const baseUnits = await client.query(`
    insert into ${SCHEMA}.inventory_item_units (
      inventory_item_id, name, level, is_base, parent_unit_id, multiplier_to_parent, factor_to_base
    )
    select item.id, source.unit, 0, true, null, 1, 1
    from ${SCHEMA}.inventory_items item
    join (
      select id as catalog_id, store_id, nullif(btrim(unit), '') as unit, 'INGREDIENT'::text as source_type
      from ${SCHEMA}.ingredients
      where deleted_at is null and store_id is not null
      union all
      select id as catalog_id, store_id, nullif(btrim(unit), '') as unit, 'PRODUCT'::text as source_type
      from ${SCHEMA}.products
      where deleted_at is null
        and store_id is not null
        and status = 'ACTIVE'
        and (parent_product_id is not null or not coalesce(is_group, false))
    ) source
      on source.store_id = item.store_id
     and ((source.source_type = 'INGREDIENT' and source.catalog_id = item.ingredient_id)
       or (source.source_type = 'PRODUCT' and source.catalog_id = item.product_id))
    where source.unit is not null
    returning id
  `);

  const missingUnits = await client.query(`
    select count(*)::int as count
    from ${SCHEMA}.inventory_items item
    left join ${SCHEMA}.inventory_item_units unit
      on unit.inventory_item_id = item.id and unit.is_base
    where unit.id is null
  `);

  return {
    ingredientItems: ingredientItems.rowCount,
    productItems: productItems.rowCount,
    baseUnits: baseUnits.rowCount,
    itemsWithoutBaseUnit: Number(missingUnits.rows[0].count),
  };
}

async function runMigration() {
  const client = await pool.connect();

  try {
    await client.query('begin');
    await client.query(`set local search_path = ${SCHEMA}, pg_catalog`);
    await requireBaseTables(client);

    if (await isAlreadyApplied(client)) {
      await client.query('commit');
      console.log('Inventory foundation Phase 1 migration was already applied; no changes made.');
      return;
    }

    await assertFreshTargetObjects(client);
    await ensureNegativeStockPolicyMarker(client);
    await createFoundationTypes(client);
    await createFoundationTables(client);
    await createUnitHierarchyGuard(client);
    const backfill = await backfillFoundation(client);

    await client.query('commit');
    console.log('Inventory foundation Phase 1 migration completed successfully.');
    console.log(JSON.stringify({
      backfill,
      legacyCompatibility: 'ingredients.current_stock remains unchanged and remains the legacy runtime balance source until a later posting-engine phase.',
      missingProductUnitBehavior: 'No base inventory_item_unit is created when the legacy catalog unit is null or blank; no unit is fabricated.',
    }, null, 2));
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    console.error('Inventory foundation Phase 1 migration failed; transaction rolled back:', error.stack || error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

void runMigration();
