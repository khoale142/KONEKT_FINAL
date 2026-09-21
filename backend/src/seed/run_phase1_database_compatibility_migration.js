import 'dotenv/config';
import { pool } from '../config/db.js';

const SCHEMA = 'public';

// Exact pg_get_constraintdef() output audited from the development database.
const LEGACY_CATEGORY_SCOPE_CHECK = {
  name: 'categories_scope_check',
  definition: "CHECK (((scope)::text = ANY ((ARRAY['PRODUCT'::character varying, 'INGREDIENT'::character varying, 'BOTH'::character varying])::text[])))",
};
const TARGET_CATEGORY_SCOPE_CHECK = {
  name: 'chk_categories_scope',
  definition: "CHECK (((scope)::text = ANY ((ARRAY['PRODUCT'::character varying, 'INGREDIENT'::character varying, 'PREPARATION'::character varying, 'BOTH'::character varying])::text[])))",
};
const LEGACY_RECIPE_QUANTITY_CHECK = {
  name: 'recipe_items_quantity_required_check',
  definition: 'CHECK ((quantity_required > (0)::numeric))',
};
const TARGET_RECIPE_QUANTITY_CHECK = {
  name: 'chk_recipe_items_quantity_required_nonnegative',
  definition: 'CHECK ((quantity_required >= (0)::numeric))',
};
const LEGACY_CURRENT_STOCK_CHECK = {
  name: 'ingredients_current_stock_check',
  definition: 'CHECK ((current_stock >= (0)::numeric))',
};
const LEGACY_BEFORE_STOCK_CHECK = {
  name: 'stock_transactions_before_stock_check',
  definition: 'CHECK ((before_stock >= (0)::numeric))',
};
const LEGACY_AFTER_STOCK_CHECK = {
  name: 'stock_transactions_after_stock_check',
  definition: 'CHECK ((after_stock >= (0)::numeric))',
};
const LEGACY_STOCK_TRANSACTION_MATH_CHECK = {
  name: 'chk_stock_transaction_math',
  definition: "CHECK ((((type = 'IMPORT'::stock_transaction_type) AND (after_stock = (before_stock + quantity))) OR ((type = 'ORDER_DEDUCT'::stock_transaction_type) AND (after_stock = (before_stock - quantity))) OR ((type = 'ORDER_REFUND'::stock_transaction_type) AND (after_stock = (before_stock + quantity))) OR (type = 'ADJUST'::stock_transaction_type)))",
};
const TARGET_STOCK_TRANSACTION_MATH_CHECK = {
  name: 'chk_stock_transaction_math',
  definition: "CHECK (((quantity > (0)::numeric) AND (((type = ANY (ARRAY['IMPORT'::stock_transaction_type, 'ORDER_REFUND'::stock_transaction_type, 'PRODUCE_ADD'::stock_transaction_type])) AND (after_stock = (before_stock + quantity))) OR ((type = ANY (ARRAY['ORDER_DEDUCT'::stock_transaction_type, 'PRODUCE_DEDUCT'::stock_transaction_type])) AND (after_stock = (before_stock - quantity))) OR (type = 'ADJUST'::stock_transaction_type))))",
};

async function requireTable(client, tableName) {
  const result = await client.query(
    `select 1
     from information_schema.tables
     where table_schema = $1 and table_name = $2`,
    [SCHEMA, tableName],
  );

  if (!result.rows[0]) {
    throw new Error(`Required table ${SCHEMA}.${tableName} does not exist.`);
  }
}

async function getColumnType(client, tableName, columnName) {
  const result = await client.query(
    `select data_type, udt_schema, udt_name
     from information_schema.columns
     where table_schema = $1 and table_name = $2 and column_name = $3`,
    [SCHEMA, tableName, columnName],
  );

  if (!result.rows[0]) {
    throw new Error(`Required column ${SCHEMA}.${tableName}.${columnName} does not exist.`);
  }

  return result.rows[0];
}

async function getColumnDefault(client, tableName, columnName) {
  const result = await client.query(
    `select column_default
     from information_schema.columns
     where table_schema = $1 and table_name = $2 and column_name = $3`,
    [SCHEMA, tableName, columnName],
  );

  return result.rows[0]?.column_default || null;
}

async function getCheckConstraints(client, tableName) {
  const result = await client.query(
    `select con.conname as name, pg_get_constraintdef(con.oid) as definition
     from pg_constraint con
     join pg_class rel on rel.oid = con.conrelid
     join pg_namespace ns on ns.oid = rel.relnamespace
     where ns.nspname = $1
       and rel.relname = $2
       and con.contype = 'c'
     order by con.conname`,
    [SCHEMA, tableName],
  );

  return result.rows;
}

function compactSql(value) {
  return String(value || '')
    .toLowerCase()
    .replaceAll(/\s+/g, '')
    .replaceAll(/[()"']/g, '');
}

function isExactConstraint(constraint, expected) {
  return constraint.name === expected.name && constraint.definition === expected.definition;
}

async function replaceKnownLegacyCheck(client, tableName, columnName, legacy, target) {
  const candidates = (await getCheckConstraints(client, tableName))
    .filter((constraint) => new RegExp(`\\b${columnName}\\b`, 'i').test(constraint.definition));

  if (candidates.length === 0) return;
  if (candidates.length !== 1) {
    throw new Error(`Unexpected multiple ${tableName}.${columnName} checks: ${JSON.stringify(candidates)}`);
  }

  const existing = candidates[0];
  if (target && isExactConstraint(existing, target)) return;
  if (!isExactConstraint(existing, legacy)) {
    throw new Error(`Unexpected ${tableName}.${columnName} check; no constraint was removed: ${JSON.stringify(existing)}`);
  }

  console.log(`Replacing legacy ${tableName}.${existing.name}.`);
  await client.query(`alter table ${SCHEMA}.${tableName} drop constraint ${quoteIdentifier(existing.name)}`);
}

async function dropKnownLegacyCheckByName(client, tableName, legacy) {
  const matches = (await getCheckConstraints(client, tableName))
    .filter((constraint) => constraint.name === legacy.name);

  if (matches.length > 1) {
    throw new Error(`Unexpected multiple ${tableName}.${legacy.name} constraints: ${JSON.stringify(matches)}`);
  }
  if (matches.length === 0) return;
  if (!isExactConstraint(matches[0], legacy)) {
    throw new Error(`Unexpected ${tableName}.${legacy.name} definition; no constraint was removed: ${JSON.stringify(matches[0])}`);
  }

  console.log(`Dropping legacy ${tableName}.${legacy.name}.`);
  await client.query(`alter table ${SCHEMA}.${tableName} drop constraint ${quoteIdentifier(legacy.name)}`);
}

async function ensureCategoryScopeCheck(client) {
  const scopeChecks = (await getCheckConstraints(client, 'categories'))
    .filter((constraint) => /\bscope\b/i.test(constraint.definition));

  if (scopeChecks.length > 1) {
    throw new Error(`Unexpected multiple category scope checks: ${JSON.stringify(scopeChecks)}`);
  }

  if (scopeChecks.length === 1) {
    const existing = scopeChecks[0];
    if (isExactConstraint(existing, TARGET_CATEGORY_SCOPE_CHECK)) {
      console.log(`Category scope check ${existing.name} already supports PREPARATION.`);
      return;
    }
    if (!isExactConstraint(existing, LEGACY_CATEGORY_SCOPE_CHECK)) {
      throw new Error(`Unexpected category scope check; no constraint was removed: ${JSON.stringify(existing)}`);
    }

    console.log(`Replacing legacy category scope check ${existing.name}.`);
    await client.query(
      `alter table ${SCHEMA}.categories drop constraint ${quoteIdentifier(existing.name)}`,
    );
  }

  await client.query(`
    alter table ${SCHEMA}.categories
    add constraint chk_categories_scope
    check (scope in ('PRODUCT', 'INGREDIENT', 'PREPARATION', 'BOTH'))
  `);
}

async function ensureRecipeQuantityCheck(client) {
  const quantityChecks = (await getCheckConstraints(client, 'recipe_items'))
    .filter((constraint) => /\bquantity_required\b/i.test(constraint.definition));

  if (quantityChecks.length > 1) {
    throw new Error(`Unexpected multiple recipe quantity checks: ${JSON.stringify(quantityChecks)}`);
  }

  if (quantityChecks.length === 1) {
    const existing = quantityChecks[0];
    if (isExactConstraint(existing, TARGET_RECIPE_QUANTITY_CHECK)) {
      console.log(`Recipe quantity check ${existing.name} already allows zero.`);
      return;
    }
    if (!isExactConstraint(existing, LEGACY_RECIPE_QUANTITY_CHECK)) {
      throw new Error(`Unexpected recipe quantity check; no constraint was removed: ${JSON.stringify(existing)}`);
    }

    console.log(`Replacing legacy recipe quantity check ${existing.name}.`);
    await client.query(
      `alter table ${SCHEMA}.recipe_items drop constraint ${quoteIdentifier(existing.name)}`,
    );
  }

  await client.query(`
    alter table ${SCHEMA}.recipe_items
    add constraint chk_recipe_items_quantity_required_nonnegative
    check (quantity_required >= 0)
  `);
}

async function ensureStockTransactionMathCheck(client) {
  const matches = (await getCheckConstraints(client, 'stock_transactions'))
    .filter((constraint) => constraint.name === LEGACY_STOCK_TRANSACTION_MATH_CHECK.name);

  if (matches.length > 1) {
    throw new Error(`Unexpected multiple stock transaction math checks: ${JSON.stringify(matches)}`);
  }
  if (matches.length === 1) {
    const existing = matches[0];
    if (isExactConstraint(existing, TARGET_STOCK_TRANSACTION_MATH_CHECK)) return;
    if (!isExactConstraint(existing, LEGACY_STOCK_TRANSACTION_MATH_CHECK)) {
      throw new Error(`Unexpected stock transaction math check; no constraint was removed: ${JSON.stringify(existing)}`);
    }

    console.log(`Replacing legacy stock transaction math check ${existing.name}.`);
    await client.query(`alter table ${SCHEMA}.stock_transactions drop constraint ${quoteIdentifier(existing.name)}`);
  }

  await client.query(`
    alter table ${SCHEMA}.stock_transactions
    add constraint chk_stock_transaction_math
    check (
      quantity > 0
      and (
        (type in ('IMPORT', 'ORDER_REFUND', 'PRODUCE_ADD') and after_stock = before_stock + quantity)
        or (type in ('ORDER_DEDUCT', 'PRODUCE_DEDUCT') and after_stock = before_stock - quantity)
        or type = 'ADJUST'
      )
    )
  `);
}

const LOW_STOCK_VIEW = 'v_low_stock_ingredients';
const EXPECTED_LOW_STOCK_VIEW_SELECT = `
  select store_id,
         id as ingredient_id,
         name as ingredient_name,
         unit,
         current_stock,
         low_stock_threshold
  from ingredients
  where deleted_at is null
    and current_stock <= low_stock_threshold
`;
const EXPECTED_VIEW_GRANTEES = new Set(['postgres', 'anon', 'authenticated', 'service_role']);

function compactViewDefinition(value) {
  return String(value || '')
    .replaceAll(/\s+/g, '')
    .replaceAll(/;+$/g, '')
    .toLowerCase();
}

function validateLowStockViewGrants(grants) {
  const invalidGrant = grants.find((grant) => (
    !EXPECTED_VIEW_GRANTEES.has(grant.grantee)
    || grant.grantor !== 'postgres'
    || !grant.privilege_type
    || typeof grant.is_grantable !== 'boolean'
  ));
  if (invalidGrant) {
    throw new Error(
      `Unexpected explicit grants on ${SCHEMA}.${LOW_STOCK_VIEW}: ${JSON.stringify(grants)}`,
    );
  }
}

function grantSignature(grants) {
  return grants
    .map((grant) => `${grant.grantee}|${grant.privilege_type}|${grant.is_grantable}|${grant.grantor}`)
    .sort()
    .join('\n');
}

function assertLowStockViewGrantsRestored(expectedGrants, actualGrants) {
  validateLowStockViewGrants(actualGrants);
  if (grantSignature(actualGrants) !== grantSignature(expectedGrants)) {
    throw new Error(
      `Explicit grants were not restored exactly on ${SCHEMA}.${LOW_STOCK_VIEW}: expected ${JSON.stringify(expectedGrants)}, found ${JSON.stringify(actualGrants)}`,
    );
  }
}

async function getLowStockViewGrants(client) {
  const result = await client.query(`
    select coalesce(grantee_role.rolname, 'PUBLIC') as grantee,
           privilege_type,
           is_grantable::text::boolean as is_grantable,
           grantor_role.rolname as grantor
    from pg_class view_class
    join pg_namespace view_namespace on view_namespace.oid = view_class.relnamespace
    cross join lateral aclexplode(view_class.relacl) as grant_entry
    left join pg_roles grantee_role on grantee_role.oid = grant_entry.grantee
    join pg_roles grantor_role on grantor_role.oid = grant_entry.grantor
    where view_namespace.nspname = $1
      and view_class.relname = $2
    order by grantee, privilege_type
  `, [SCHEMA, LOW_STOCK_VIEW]);

  return result.rows;
}

async function preflightLowStockView(client) {
  const viewResult = await client.query(`
    select view_class.oid,
           view_class.relkind,
           pg_get_userbyid(view_class.relowner) as owner,
           view_class.reloptions,
           view_class.relrowsecurity,
           view_class.relforcerowsecurity,
           obj_description(view_class.oid, 'pg_class') as comment,
           pg_get_viewdef(view_class.oid, true) as select_definition,
           information_schema_view.check_option
    from pg_class view_class
    join pg_namespace view_namespace on view_namespace.oid = view_class.relnamespace
    left join information_schema.views information_schema_view
      on information_schema_view.table_schema = view_namespace.nspname
     and information_schema_view.table_name = view_class.relname
    where view_namespace.nspname = $1
      and view_class.relname = $2
  `, [SCHEMA, LOW_STOCK_VIEW]);
  const view = viewResult.rows[0];

  if (!view) {
    throw new Error(`Required audited view ${SCHEMA}.${LOW_STOCK_VIEW} does not exist.`);
  }

  if (
    view.relkind !== 'v'
    || view.reloptions !== null
    || view.relrowsecurity
    || view.relforcerowsecurity
    || view.check_option !== 'NONE'
    || compactViewDefinition(view.select_definition) !== compactViewDefinition(EXPECTED_LOW_STOCK_VIEW_SELECT)
  ) {
    throw new Error(`Audited view ${SCHEMA}.${LOW_STOCK_VIEW} differs materially from the expected definition or properties: ${JSON.stringify(view)}`);
  }

  const rulesResult = await client.query(`
    select rewrite_rule.oid::text as rule_oid,
           rewrite_rule.rulename,
           rewrite_rule.ev_type,
           rewrite_rule.is_instead
    from pg_rewrite rewrite_rule
    where rewrite_rule.ev_class = $1
    order by rewrite_rule.rulename
  `, [view.oid]);
  const rules = rulesResult.rows;
  if (
    rules.length !== 1
    || rules[0].rulename !== '_RETURN'
    || rules[0].ev_type !== '1'
    || !rules[0].is_instead
  ) {
    throw new Error(`Audited view ${SCHEMA}.${LOW_STOCK_VIEW} has unexpected rules: ${JSON.stringify(rules)}`);
  }

  const triggerResult = await client.query(
    `select tgname
     from pg_trigger
     where tgrelid = $1 and not tgisinternal
     order by tgname`,
    [view.oid],
  );
  if (triggerResult.rows.length) {
    throw new Error(`Audited view ${SCHEMA}.${LOW_STOCK_VIEW} has unexpected triggers: ${JSON.stringify(triggerResult.rows)}`);
  }

  const dependentsResult = await client.query(`
    select classid::regclass::text as dependency_catalog,
           objid::text as dependency_object_id,
           deptype
    from pg_depend
    where refobjid = $1
    order by dependency_catalog, dependency_object_id`,
    [view.oid],
  );
  const unexpectedDependents = dependentsResult.rows.filter((dependency) => !(
    dependency.deptype === 'i'
    && (
      (dependency.dependency_catalog === 'pg_rewrite' && dependency.dependency_object_id === rules[0].rule_oid)
      || dependency.dependency_catalog === 'pg_type'
    )
  ));
  if (unexpectedDependents.length) {
    throw new Error(`Audited view ${SCHEMA}.${LOW_STOCK_VIEW} has external dependents: ${JSON.stringify(unexpectedDependents)}`);
  }

  const grants = await getLowStockViewGrants(client);
  validateLowStockViewGrants(grants);

  return { ...view, grants, returnRuleOid: rules[0].rule_oid };
}

async function restoreLowStockView(client, viewMetadata) {
  // The audited definition intentionally uses an unqualified table name. Pin the
  // transaction-local resolution to public so recreation is deterministic.
  await client.query(`set local search_path = public, pg_catalog`);
  await client.query(`
    create view ${SCHEMA}.${LOW_STOCK_VIEW} as
    select store_id,
           id as ingredient_id,
           name as ingredient_name,
           unit,
           current_stock,
           low_stock_threshold
    from ingredients
    where deleted_at is null
      and current_stock <= low_stock_threshold
  `);
  await client.query(
    `alter view ${SCHEMA}.${LOW_STOCK_VIEW} owner to ${quoteIdentifier(viewMetadata.owner)}`,
  );

  for (const grant of viewMetadata.grants) {
    await client.query(
      `grant ${grant.privilege_type} on table ${SCHEMA}.${LOW_STOCK_VIEW}
       to ${quoteIdentifier(grant.grantee)}${grant.is_grantable ? ' with grant option' : ''}`,
    );
  }

  if (viewMetadata.comment !== null) {
    await client.query(
      `comment on view ${SCHEMA}.${LOW_STOCK_VIEW} is ${quoteLiteral(viewMetadata.comment)}`,
    );
  }

  const unitColumnResult = await client.query(`
    select data_type, udt_schema, udt_name
    from information_schema.columns
    where table_schema = $1
      and table_name = $2
      and column_name = 'unit'
  `, [SCHEMA, LOW_STOCK_VIEW]);
  const unitColumn = unitColumnResult.rows[0];
  if (
    !unitColumn
    || unitColumn.data_type !== 'text'
    || unitColumn.udt_schema !== 'pg_catalog'
    || unitColumn.udt_name !== 'text'
  ) {
    throw new Error(`Recreated ${SCHEMA}.${LOW_STOCK_VIEW}.unit is not text: ${JSON.stringify(unitColumn)}`);
  }

  assertLowStockViewGrantsRestored(viewMetadata.grants, await getLowStockViewGrants(client));
}

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function extractEnumDefaultLiteral(columnDefault) {
  if (!columnDefault) return null;

  const match = columnDefault.match(/^'((?:''|[^'])*)'(?:::[\w.]+)?$/);
  if (!match) {
    throw new Error(`ingredients.unit has an unsupported enum default expression: ${columnDefault}`);
  }

  return match[1].replaceAll("''", "'");
}

function quoteLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function assertNoVariantDuplicates(client) {
  const sizeDuplicates = await client.query(
    `select parent_product_id,
            lower(btrim(size_name)) as normalized_size_name,
            count(*)::int as duplicate_count
     from ${SCHEMA}.products
     where parent_product_id is not null
       and deleted_at is null
       and size_name is not null
     group by parent_product_id, lower(btrim(size_name))
     having count(*) > 1
     order by parent_product_id, normalized_size_name`,
  );

  if (sizeDuplicates.rows.length) {
    throw new Error(
      `Cannot add the active variant size-name uniqueness index. Duplicate rows found: ${JSON.stringify(sizeDuplicates.rows)}. No data was rewritten.`,
    );
  }

  const sortDuplicates = await client.query(
    `select parent_product_id, sort_order, count(*)::int as duplicate_count
     from ${SCHEMA}.products
     where parent_product_id is not null
       and deleted_at is null
       and sort_order is not null
     group by parent_product_id, sort_order
     having count(*) > 1
     order by parent_product_id, sort_order`,
  );

  if (sortDuplicates.rows.length) {
    throw new Error(
      `Cannot add the active variant sort-order uniqueness index. Duplicate rows found: ${JSON.stringify(sortDuplicates.rows)}. No data was rewritten.`,
    );
  }
}

async function ensureUniqueIndex(client, indexName, createSql) {
  const existing = await client.query(
    `select i.indisunique,
            pg_get_indexdef(i.indexrelid) as indexdef,
            pg_get_expr(i.indpred, i.indrelid) as predicate,
            array_agg(pg_get_indexdef(i.indexrelid, key_position.position, true) order by key_position.position) as key_expressions
     from pg_class index_class
     join pg_namespace index_namespace on index_namespace.oid = index_class.relnamespace
     join pg_index i on i.indexrelid = index_class.oid
     join lateral generate_series(1, i.indnkeyatts) as key_position(position) on true
     where index_namespace.nspname = $1
       and index_class.relname = $2
     group by i.indisunique, i.indexrelid, i.indpred, i.indrelid`,
    [SCHEMA, indexName],
  );

  if (existing.rows[0]) {
    const actual = existing.rows[0];
    const expected = indexName === 'uq_products_variant_parent_size_name_active'
      ? {
          keys: ['parent_product_id', 'lowerbtrimsize_name'],
          predicate: 'parent_product_idisnotnullandsize_nameisnotnullanddeleted_atisnull',
        }
      : {
          keys: ['parent_product_id', 'sort_order'],
          predicate: 'parent_product_idisnotnullandsort_orderisnotnullanddeleted_atisnull',
        };
    const actualKeys = actual.key_expressions.map(compactSql);

    if (
      !actual.indisunique
      || actualKeys.length !== expected.keys.length
      || actualKeys.some((key, index) => key !== expected.keys[index])
      || compactSql(actual.predicate) !== expected.predicate
    ) {
      throw new Error(
        `Index ${SCHEMA}.${indexName} exists with an unexpected definition. Expected keys ${JSON.stringify(expected.keys)} and predicate ${expected.predicate}; found ${JSON.stringify(actual)}.`,
      );
    }
    return;
  }

  await client.query(createSql);
}

async function runMigration() {
  const client = await pool.connect();

  try {
    await client.query('begin');

    for (const tableName of ['categories', 'ingredients', 'products', 'recipe_items', 'stores', 'stock_transactions']) {
      await requireTable(client, tableName);
    }

    const ingredientUnitType = await getColumnType(client, 'ingredients', 'unit');
    let lowStockViewMetadata = null;
    if (ingredientUnitType.data_type === 'USER-DEFINED') {
      lowStockViewMetadata = await preflightLowStockView(client);
    }

    // Categories: retain BOTH for legacy data while accepting the finalized PREPARATION scope.
    await ensureCategoryScopeCheck(client);

    // Ingredients: convert only the closed enum column to text. Keep the enum itself because
    // other database objects may still depend on it.
    if (ingredientUnitType.data_type === 'USER-DEFINED') {
      console.log(`Converting ingredients.unit from enum ${ingredientUnitType.udt_schema}.${ingredientUnitType.udt_name} to text.`);
      const existingUnitDefault = extractEnumDefaultLiteral(
        await getColumnDefault(client, 'ingredients', 'unit'),
      );
      await client.query(`drop view ${SCHEMA}.${LOW_STOCK_VIEW}`);
      await client.query(`alter table ${SCHEMA}.ingredients alter column unit drop default`);
      await client.query(`
        alter table ${SCHEMA}.ingredients
        alter column unit type text using unit::text
      `);
      await restoreLowStockView(client, lowStockViewMetadata);
      if (existingUnitDefault !== null) {
        await client.query(
          `alter table ${SCHEMA}.ingredients alter column unit set default ${quoteLiteral(existingUnitDefault)}`,
        );
      }
    } else if (!['text', 'character varying', 'character'].includes(ingredientUnitType.data_type)) {
      throw new Error(`ingredients.unit has unsupported type ${ingredientUnitType.data_type}. Expected enum or text-like type.`);
    }

    // Products: nullable in Phase 1 to preserve legacy rows. Later services will require it
    // for newly created and updated scoped products.
    await client.query(`alter table ${SCHEMA}.products add column if not exists unit text`);

    // Recipe quantities: zero is valid for product-size matrices; negative values remain invalid.
    await ensureRecipeQuantityCheck(client);

    // Product variants: no data conversion is performed. Existing variants retain NULL order
    // until a later product-size conversion/reordering flow assigns a meaningful value.
    await client.query(`alter table ${SCHEMA}.products add column if not exists sort_order integer`);
    await assertNoVariantDuplicates(client);
    await ensureUniqueIndex(
      client,
      'uq_products_variant_parent_size_name_active',
      `create unique index uq_products_variant_parent_size_name_active
       on ${SCHEMA}.products (parent_product_id, lower(btrim(size_name)))
       where parent_product_id is not null
         and size_name is not null
         and deleted_at is null`,
    );
    await ensureUniqueIndex(
      client,
      'uq_products_variant_parent_sort_order_active',
      `create unique index uq_products_variant_parent_sort_order_active
       on ${SCHEMA}.products (parent_product_id, sort_order)
       where parent_product_id is not null
         and sort_order is not null
         and deleted_at is null`,
    );

    // Existing stores receive the finalized default policy without touching legacy business rows.
    await client.query(`alter table ${SCHEMA}.stores add column if not exists allow_negative_stock boolean`);
    await client.query(`update ${SCHEMA}.stores set allow_negative_stock = true where allow_negative_stock is null`);
    await client.query(`alter table ${SCHEMA}.stores alter column allow_negative_stock set default true`);
    await client.query(`alter table ${SCHEMA}.stores alter column allow_negative_stock set not null`);

    // Inventory balances may be negative. Quantity remains positive and stock direction is
    // enforced by transaction type below.
    await replaceKnownLegacyCheck(
      client,
      'ingredients',
      'current_stock',
      LEGACY_CURRENT_STOCK_CHECK,
      null,
    );
    await dropKnownLegacyCheckByName(client, 'stock_transactions', LEGACY_BEFORE_STOCK_CHECK);
    await dropKnownLegacyCheckByName(client, 'stock_transactions', LEGACY_AFTER_STOCK_CHECK);
    await ensureStockTransactionMathCheck(client);

    await client.query('commit');
    console.log('Phase 1 database compatibility migration completed successfully.');
  } catch (error) {
    await client.query('rollback');
    console.error('Phase 1 database compatibility migration failed:', error.stack || error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

void runMigration();
