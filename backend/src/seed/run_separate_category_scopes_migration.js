import 'dotenv/config';
import { pool } from '../config/db.js';

const SCOPES = ['PRODUCT', 'INGREDIENT', 'PREPARATION'];
const LEGACY_SCOPES = [...SCOPES, 'BOTH'];
const suffixByScope = {
  PRODUCT: ' (Sản phẩm)',
  INGREDIENT: ' (Nguyên liệu)',
  PREPARATION: ' (Bán thành phẩm)',
};

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function quotedValues(definition) {
  return [...definition.matchAll(/'((?:''|[^'])*)'/g)]
    .map((match) => match[1].replaceAll("''", "'"))
    .filter((value) => /^[A-Z_]+$/.test(value));
}

function sameValues(actual, expected) {
  return actual.length === expected.length && actual.every((value) => expected.includes(value));
}

function splitName(name, scope) {
  const suffix = suffixByScope[scope];
  return `${name.slice(0, 80 - suffix.length)}${suffix}`;
}

async function ensureNameAvailable(client, storeId, name) {
  const result = await client.query(
    `select id from categories
     where store_id = $1 and lower(name) = lower($2) and deleted_at is null limit 1`,
    [storeId, name],
  );
  if (result.rows[0]) {
    throw new Error(`Cannot split legacy shared category: active category name already exists: ${name}`);
  }
}

async function getScopeConstraint(client) {
  const result = await client.query(
    `select con.conname, pg_get_constraintdef(con.oid) as definition,
            array_agg(att.attname order by att.attnum) as columns
     from pg_constraint con
     join pg_class rel on rel.oid = con.conrelid
     join pg_namespace ns on ns.oid = rel.relnamespace
     join unnest(con.conkey) key(attnum) on true
     join pg_attribute att on att.attrelid = rel.oid and att.attnum = key.attnum
     where ns.nspname = 'public' and rel.relname = 'categories' and con.contype = 'c'
     group by con.oid, con.conname`,
  );
  const candidates = result.rows.filter((constraint) => (
    constraint.columns.length === 1 && constraint.columns[0] === 'scope'
  ));
  if (candidates.length !== 1) throw new Error('Expected exactly one categories.scope check constraint.');
  const constraint = candidates[0];
  const values = quotedValues(constraint.definition);
  if (!sameValues(values, LEGACY_SCOPES) && !sameValues(values, SCOPES)) {
    throw new Error(`Unexpected categories.scope constraint: ${constraint.definition}`);
  }
  return { ...constraint, values };
}

async function splitLegacyCategory(client, category) {
  const counts = await client.query(
    `select
       (select count(*) from products where category_id = $1 and store_id = $2 and deleted_at is null) as product_count,
       (select count(*) from ingredients where category_id = $1 and store_id = $2 and deleted_at is null and is_preparation = false) as ingredient_count,
       (select count(*) from ingredients where category_id = $1 and store_id = $2 and deleted_at is null and is_preparation = true) as preparation_count`,
    [category.id, category.store_id],
  );
  const count = counts.rows[0];
  const usedScopes = [
    Number(count.product_count) > 0 && 'PRODUCT',
    Number(count.ingredient_count) > 0 && 'INGREDIENT',
    Number(count.preparation_count) > 0 && 'PREPARATION',
  ].filter(Boolean);
  const retainedScope = usedScopes[0] || 'PRODUCT';
  await client.query('update categories set scope = $1, updated_at = now() where id = $2', [retainedScope, category.id]);

  for (const scope of usedScopes.slice(1)) {
    const name = splitName(category.name, scope);
    await ensureNameAvailable(client, category.store_id, name);
    const inserted = await client.query(
      `insert into categories (store_id, name, scope, created_by)
       values ($1, $2, $3, $4) returning id`,
      [category.store_id, name, scope, category.created_by],
    );
    const categoryId = inserted.rows[0].id;
    if (scope === 'PRODUCT') {
      await client.query('update products set category_id = $1 where category_id = $2 and store_id = $3 and deleted_at is null', [categoryId, category.id, category.store_id]);
    } else {
      await client.query(
        `update ingredients set category_id = $1
         where category_id = $2 and store_id = $3 and deleted_at is null and is_preparation = $4`,
        [categoryId, category.id, category.store_id, scope === 'PREPARATION'],
      );
    }
  }
}

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const constraint = await getScopeConstraint(client);
    if (sameValues(constraint.values, LEGACY_SCOPES)) {
      const legacyCategories = await client.query(
        `select id, store_id, name, created_by from categories
         where scope = 'BOTH' and deleted_at is null order by store_id, created_at for update`,
      );
      for (const category of legacyCategories.rows) await splitLegacyCategory(client, category);
      await client.query(
        `update categories set scope = 'PRODUCT', updated_at = now()
         where scope = 'BOTH' and deleted_at is not null`,
      );
      await client.query(`alter table public.categories drop constraint ${quoteIdentifier(constraint.conname)}`);
      await client.query(
        `alter table public.categories add constraint chk_categories_scope
         check (scope in ('PRODUCT', 'INGREDIENT', 'PREPARATION'))`,
      );
    }
    await client.query('commit');
    console.log('Separate category scopes migration completed successfully.');
  } catch (error) {
    await client.query('rollback');
    console.error(error.stack || error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

void runMigration();
