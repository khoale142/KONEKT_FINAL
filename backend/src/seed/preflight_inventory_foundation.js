import { pool } from '../config/db.js';

const SCHEMA = 'public';
const TARGET_TABLES = ['inventory_items', 'inventory_item_units', 'storage_locations'];

function numeric(value) {
  return value === null || value === undefined ? null : Number(value);
}

function hasBlockingIssue(report) {
  return report.blockers.some((blocker) => blocker.blocking);
}

async function one(client, sql, params = []) {
  const result = await client.query(sql, params);
  return result.rows[0] || {};
}

async function rows(client, sql, params = []) {
  const result = await client.query(sql, params);
  return result.rows;
}

async function runSequential(tasks) {
  const results = [];
  for (const task of tasks) {
    results.push(await task());
  }
  return results;
}

async function runPreflight() {
  const client = await pool.connect();

  try {
    // This transaction deliberately rejects every write, including accidental writes from a
    // future edit to this script. The transaction is rolled back in all cases.
    await client.query('begin read only');
    await client.query(`set local search_path = ${SCHEMA}, pg_catalog`);

    const [version, ingredients, products, balanceSummary, negativeBalances, thresholdSummary,
      productUnits, storePolicies, targetTables, sourceDuplicates, uuidFunction] = await runSequential([
      () => one(client, 'show server_version_num'),
      () => one(client, `
        select
          count(*) filter (where deleted_at is null and store_id is not null and not coalesce(is_preparation, false))::int as active_store_raw,
          count(*) filter (where deleted_at is null and store_id is not null and coalesce(is_preparation, false))::int as active_store_preparations,
          count(*) filter (where deleted_at is not null and store_id is not null)::int as deleted_store_scoped,
          count(*) filter (where store_id is null)::int as null_store_total,
          count(*) filter (where deleted_at is null and store_id is null)::int as null_store_active,
          count(*) filter (where deleted_at is not null and store_id is null)::int as null_store_deleted
        from ingredients`),
      () => one(client, `
        select
          count(*) filter (
            where deleted_at is null and store_id is not null
              and parent_product_id is null and not coalesce(is_group, false)
          )::int as active_store_normal_sellable,
          count(*) filter (
            where deleted_at is null and store_id is not null
              and parent_product_id is null and coalesce(is_group, false)
          )::int as active_store_group_parents,
          count(*) filter (
            where deleted_at is null and store_id is not null and parent_product_id is not null
          )::int as active_store_variants,
          count(*) filter (where deleted_at is null and store_id is not null and status = 'ACTIVE')::int as active_store_status,
          count(*) filter (where deleted_at is null and store_id is not null and status = 'INACTIVE')::int as inactive_store_status,
          count(*) filter (where deleted_at is not null and store_id is not null)::int as deleted_store_scoped,
          count(*) filter (where store_id is null)::int as null_store_total,
          count(*) filter (where deleted_at is null and store_id is null)::int as null_store_active,
          count(*) filter (where deleted_at is not null and store_id is null)::int as null_store_deleted
        from products`),
      () => one(client, `
        select
          count(*) filter (where deleted_at is null and store_id is not null)::int as eligible_ingredient_rows,
          coalesce(sum(current_stock) filter (where deleted_at is null and store_id is not null), 0)::numeric as eligible_quantity_sum,
          count(distinct store_id) filter (where deleted_at is null and store_id is not null)::int as stores_with_ingredient_balance,
          count(*) filter (where deleted_at is null and store_id is null)::int as active_unowned_ingredients
        from ingredients`),
      () => rows(client, `
        select store_id::text as store_id,
               count(*)::int as negative_ingredient_count,
               min(current_stock)::numeric as lowest_quantity
        from ingredients
        where deleted_at is null and store_id is not null and current_stock < 0
        group by store_id
        order by negative_ingredient_count desc, store_id`),
      () => one(client, `
        select
          count(*) filter (where deleted_at is null and store_id is not null and low_stock_threshold < 0)::int as negative_threshold_count,
          count(*) filter (where deleted_at is null and store_id is not null and low_stock_threshold is null)::int as null_threshold_count,
          count(*) filter (where deleted_at is null and store_id is not null)::int as eligible_rows
        from ingredients`),
      () => one(client, `
        select
          count(*) filter (where deleted_at is null and store_id is not null
            and status = 'ACTIVE'
            and parent_product_id is null and not coalesce(is_group, false))::int
            + count(*) filter (where deleted_at is null and store_id is not null
              and status = 'ACTIVE' and parent_product_id is not null)::int
            as recipe_on_sale_candidate_count,
          count(*) filter (where deleted_at is null and store_id is not null and status = 'ACTIVE' and unit is null)::int as missing_active_store_product_unit_count,
          count(*) filter (where deleted_at is null and store_id is not null and status = 'ACTIVE' and nullif(btrim(unit), '') is null)::int as blank_or_missing_active_store_product_unit_count,
          count(distinct nullif(btrim(unit), '')) filter (where deleted_at is null and store_id is not null)::int as distinct_product_units,
          count(distinct nullif(btrim(unit), '')) filter (where deleted_at is null and store_id is not null) as _unused
        from products`),
      () => rows(client, `
        select s.id::text as store_id, s.name as store_name, s.allow_negative_stock,
               (to_jsonb(s) ->> 'negative_stock_policy_configured_at')::timestamp with time zone
                 as negative_stock_policy_configured_at
        from stores s
        order by s.name, s.id`),
      () => rows(client, `
        select requested.table_name,
               (table_info.table_name is not null) as exists
        from unnest($1::text[]) as requested(table_name)
        left join information_schema.tables table_info
          on table_info.table_schema = $2
         and table_info.table_name = requested.table_name
        order by requested.table_name`, [TARGET_TABLES, SCHEMA]),
      () => rows(client, `
        select source, store_id::text as store_id, catalog_id::text as catalog_id, count(*)::int as duplicate_count
        from (
          select 'ingredient'::text as source, store_id, id as catalog_id
          from ingredients
          where deleted_at is null and store_id is not null
          union all
          select 'product'::text as source, store_id, id as catalog_id
          from products
          where deleted_at is null
            and store_id is not null
            and (parent_product_id is not null or not coalesce(is_group, false))
        ) candidates
        group by source, store_id, catalog_id
        having count(*) > 1
        order by source, store_id, catalog_id`),
      () => one(client, `select to_regprocedure('gen_random_uuid()') is not null as available`),
    ]);

    const activeIngredientUnitRows = await rows(client, `
      select unit, count(*)::int as count
      from ingredients
      where deleted_at is null and store_id is not null
      group by unit
      order by count desc, unit asc`);
    const activeProductUnitRows = await rows(client, `
      select nullif(btrim(unit), '') as unit, count(*)::int as count
      from products
      where deleted_at is null and store_id is not null
      group by nullif(btrim(unit), '')
      order by count desc, unit asc nulls first`);

    const existingTargetTables = targetTables.filter((table) => table.exists).map((table) => table.table_name);
    const blockers = [
      ...(existingTargetTables.length ? [{
        code: 'TARGET_TABLE_CONFLICT',
        blocking: true,
        message: `Target tables already exist: ${existingTargetTables.join(', ')}. Do not run the foundation migration until their provenance is reviewed.`,
      }] : []),
      ...(sourceDuplicates.length ? [{
        code: 'DUPLICATE_STORE_CATALOG_SOURCE',
        blocking: true,
        message: 'Duplicate Store + catalog candidates would violate inventory item uniqueness.',
        rows: sourceDuplicates,
      }] : []),
      ...(!uuidFunction.available ? [{
        code: 'MISSING_GEN_RANDOM_UUID',
        blocking: true,
        message: 'gen_random_uuid() is unavailable but is required by current repository UUID conventions.',
      }] : []),
      ...(Number(thresholdSummary.negative_threshold_count) > 0 ? [{
        code: 'NEGATIVE_LEGACY_THRESHOLD',
        blocking: true,
        message: 'Negative active legacy low-stock thresholds cannot be copied into the new non-negative field.',
      }] : []),
      ...(Number(ingredients.null_store_total) > 0 ? [{
        code: 'NULL_STORE_LEGACY_INGREDIENTS',
        blocking: false,
        message: 'Legacy Ingredients without store ownership are intentionally excluded; no ownership is inferred.',
      }] : []),
      ...(Number(products.null_store_total) > 0 ? [{
        code: 'NULL_STORE_LEGACY_PRODUCTS',
        blocking: false,
        message: 'Legacy Products without store ownership are intentionally excluded; no ownership is inferred.',
      }] : []),
      ...(Number(productUnits.blank_or_missing_active_store_product_unit_count) > 0 ? [{
        code: 'MISSING_PRODUCT_UNIT',
        blocking: false,
        message: 'Eligible Products without a usable unit receive no base unit; the migration does not fabricate one.',
      }] : []),
    ];

    const report = {
      phase: 'inventory-foundation-preflight',
      readOnly: true,
      postgresVersionNumber: version.server_version_num,
      ingredients: {
        activeStoreRaw: Number(ingredients.active_store_raw),
        activeStorePreparations: Number(ingredients.active_store_preparations),
        deletedStoreScoped: Number(ingredients.deleted_store_scoped),
        nullStoreTotal: Number(ingredients.null_store_total),
        nullStoreActive: Number(ingredients.null_store_active),
        nullStoreDeleted: Number(ingredients.null_store_deleted),
        activeStoreUnits: activeIngredientUnitRows,
      },
      products: {
        activeStoreNormalSellable: Number(products.active_store_normal_sellable),
        activeStoreGroupParents: Number(products.active_store_group_parents),
        activeStoreVariants: Number(products.active_store_variants),
        activeStoreStatus: Number(products.active_store_status),
        inactiveStoreStatus: Number(products.inactive_store_status),
        deletedStoreScoped: Number(products.deleted_store_scoped),
        nullStoreTotal: Number(products.null_store_total),
        nullStoreActive: Number(products.null_store_active),
        nullStoreDeleted: Number(products.null_store_deleted),
        recipeOnSaleCandidates: Number(productUnits.recipe_on_sale_candidate_count),
        missingActiveStoreProductUnits: Number(productUnits.missing_active_store_product_unit_count),
        blankOrMissingActiveStoreProductUnits: Number(productUnits.blank_or_missing_active_store_product_unit_count),
        activeStoreUnits: activeProductUnitRows,
      },
      balances: {
        eligibleIngredientRows: Number(balanceSummary.eligible_ingredient_rows),
        eligibleQuantitySum: numeric(balanceSummary.eligible_quantity_sum),
        storesWithIngredientBalance: Number(balanceSummary.stores_with_ingredient_balance),
        activeUnownedIngredients: Number(balanceSummary.active_unowned_ingredients),
        negativeBalances,
        negativeThresholdCount: Number(thresholdSummary.negative_threshold_count),
        nullThresholdCount: Number(thresholdSummary.null_threshold_count),
      },
      storePolicies,
      targetTables,
      duplicateOrAmbiguousStoreCatalogRelationships: sourceDuplicates,
      blockers,
    };
    report.canSafelyProceed = !hasBlockingIssue(report);

    console.log(JSON.stringify(report, null, 2));
    await client.query('rollback');
    return report;
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    console.error('Inventory foundation preflight failed:', error.stack || error);
    process.exitCode = 1;
    return null;
  } finally {
    client.release();
    await pool.end();
  }
}

void runPreflight();
