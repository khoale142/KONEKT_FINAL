import { query } from '../../config/db.js';
import { UNITS } from '../../constants/units.js';
import { ApiError } from '../../utils/ApiError.js';
import { toPublicIngredient } from '../../utils/ingredient.js';
import { DEFAULT_INGREDIENT_TAG } from '../../utils/tagTaxonomy.js';

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeUnit(value) {
  return normalizeString(value).toUpperCase();
}

function normalizeTag(value) {
  const normalizedValue = normalizeString(value);
  return normalizedValue || DEFAULT_INGREDIENT_TAG;
}

function ensureValidName(name) {
  if (!name) {
    throw new ApiError(400, 'Ingredient name is required.');
  }

  if (name.length > 120) {
    throw new ApiError(400, 'Ingredient name must not exceed 120 characters.');
  }
}

function ensureValidUnit(unit) {
  if (!Object.values(UNITS).includes(unit)) {
    throw new ApiError(400, 'Ingredient unit is invalid.');
  }
}

function ensureNonNegativeNumber(value, fieldName) {
  const normalizedValue = Number(value);

  if (!Number.isFinite(normalizedValue)) {
    throw new ApiError(400, `${fieldName} is invalid.`);
  }

  if (normalizedValue < 0) {
    throw new ApiError(400, `${fieldName} cannot be negative.`);
  }

  return normalizedValue;
}

function ensureValidTag(tag) {
  if (!tag) {
    throw new ApiError(400, 'Ingredient tag is required.');
  }

  if (tag.length > 40) {
    throw new ApiError(400, 'Ingredient tag must not exceed 40 characters.');
  }
}

async function findIngredientRowById(ingredientId, storeId) {
  const result = await query(
    `select i.id,
            i.name,
            i.tag,
            i.unit,
            i.current_stock,
            i.low_stock_threshold,
            i.created_at,
            i.updated_at,
            (i.current_stock <= i.low_stock_threshold) as is_low_stock
     from ingredients i
     where i.id = $1
       and i.store_id = $2
       and i.deleted_at is null
     limit 1`,
    [ingredientId, storeId],
  );

  return result.rows[0] || null;
}

async function ensureUniqueIngredientName(name, storeId, excludeIngredientId = null) {
  const params = [name, storeId];
  const conditions = ['lower(name) = lower($1)', 'store_id = $2', 'deleted_at is null'];

  if (excludeIngredientId) {
    params.push(excludeIngredientId);
    conditions.push(`id <> $${params.length}`);
  }

  const result = await query(
    `select id
     from ingredients
     where ${conditions.join(' and ')}
     limit 1`,
    params,
  );

  if (result.rows[0]) {
    throw new ApiError(409, 'Ingredient name already exists.');
  }
}

async function ensureDeleteAllowed(ingredientId, storeId) {
  const [recipeUsageResult, stockTransactionResult] = await Promise.all([
    query(
      `select exists(
         select 1
         from recipe_items
         join recipes on recipes.id = recipe_items.recipe_id
         where recipe_items.ingredient_id = $1 and recipes.store_id = $2
       ) as is_used`,
      [ingredientId, storeId],
    ),
    query(
      `select exists(
         select 1
         from stock_transactions
         where ingredient_id = $1 and store_id = $2
       ) as has_transaction`,
      [ingredientId, storeId],
    ),
  ]);

  if (recipeUsageResult.rows[0]?.is_used) {
    throw new ApiError(400, 'Cannot delete ingredient because it is already used in recipes.');
  }

  if (stockTransactionResult.rows[0]?.has_transaction) {
    throw new ApiError(400, 'Cannot delete ingredient because it already has stock transactions.');
  }
}

export async function listIngredientTags(storeId) {
  const result = await query(
    `select tag
     from (
       select distinct i.tag
       from ingredients i
       where i.store_id = $1
         and i.deleted_at is null
         and i.tag is not null
         and btrim(i.tag) <> ''
     ) ingredient_tags
     order by lower(tag) asc`,
    [storeId]
  );

  return result.rows.map((row) => row.tag).filter(Boolean);
}

export async function listIngredients({ search = '', lowStock, tag } = {}, storeId) {
  const params = [storeId];
  const conditions = ['i.store_id = $1', 'i.deleted_at is null'];
  const normalizedSearch = normalizeString(search);
  const isLowStockOnly = String(lowStock).toLowerCase() === 'true';
  const normalizedTag = normalizeTag(tag);

  if (normalizedSearch) {
    params.push(`%${normalizedSearch}%`);
    conditions.push(`i.name ilike $${params.length}`);
  }

  if (isLowStockOnly) {
    conditions.push('i.current_stock <= i.low_stock_threshold');
  }

  if (normalizeString(tag) && normalizedTag !== 'ALL') {
    ensureValidTag(normalizedTag);
    params.push(normalizedTag);
    conditions.push(`lower(i.tag) = lower($${params.length})`);
  }

  const result = await query(
    `select i.id,
            i.name,
            i.tag,
            i.unit,
            i.current_stock,
            i.low_stock_threshold,
            i.created_at,
            i.updated_at,
            (i.current_stock <= i.low_stock_threshold) as is_low_stock
     from ingredients i
     where ${conditions.join(' and ')}
     order by i.created_at desc, i.name asc`,
    params,
  );

  return result.rows.map(toPublicIngredient);
}

export async function getIngredientById(ingredientId, storeId) {
  const ingredient = await findIngredientRowById(ingredientId, storeId);

  if (!ingredient) {
    throw new ApiError(404, 'Ingredient not found.');
  }

  return toPublicIngredient(ingredient);
}

export async function createIngredient(payload, actorUser, storeId) {
  const name = normalizeString(payload.name);
  const tag = normalizeTag(payload.tag);
  const unit = normalizeUnit(payload.unit);
  const lowStockThreshold = ensureNonNegativeNumber(
    payload.lowStockThreshold ?? payload.low_stock_threshold ?? 0,
    'Low stock threshold',
  );

  ensureValidName(name);
  ensureValidTag(tag);
  ensureValidUnit(unit);
  await ensureUniqueIngredientName(name, storeId);

  const result = await query(
    `insert into ingredients (name, tag, unit, current_stock, low_stock_threshold, created_by, store_id)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning id`,
    [name, tag, unit, 0, lowStockThreshold, actorUser.id, storeId],
  );

  return getIngredientById(result.rows[0].id, storeId);
}

export async function updateIngredient(ingredientId, payload, storeId) {
  const existingIngredient = await findIngredientRowById(ingredientId, storeId);

  if (!existingIngredient) {
    throw new ApiError(404, 'Ingredient not found.');
  }

  if (payload.currentStock !== undefined || payload.current_stock !== undefined) {
    throw new ApiError(400, 'Current stock must be changed from stock transactions.');
  }

  const nextName =
    payload.name === undefined ? existingIngredient.name : normalizeString(payload.name);
  const nextTag =
    payload.tag === undefined ? normalizeTag(existingIngredient.tag) : normalizeTag(payload.tag);
  const nextUnit =
    payload.unit === undefined ? existingIngredient.unit : normalizeUnit(payload.unit);
  const nextLowStockThreshold =
    payload.lowStockThreshold === undefined && payload.low_stock_threshold === undefined
      ? Number(existingIngredient.low_stock_threshold)
      : ensureNonNegativeNumber(
          payload.lowStockThreshold ?? payload.low_stock_threshold,
          'Low stock threshold',
        );

  ensureValidName(nextName);
  ensureValidTag(nextTag);
  ensureValidUnit(nextUnit);
  await ensureUniqueIngredientName(nextName, storeId, existingIngredient.id);

  await query(
    `update ingredients
     set name = $1,
         tag = $2,
         unit = $3,
         low_stock_threshold = $4,
         updated_at = now()
     where id = $5
       and store_id = $6
       and deleted_at is null`,
    [nextName, nextTag, nextUnit, nextLowStockThreshold, ingredientId, storeId],
  );

  return getIngredientById(ingredientId, storeId);
}

export async function softDeleteIngredient(ingredientId, storeId) {
  const ingredient = await getIngredientById(ingredientId, storeId);

  await ensureDeleteAllowed(ingredientId, storeId);

  await query(
    `update ingredients
     set deleted_at = now(),
         updated_at = now()
     where id = $1
       and store_id = $2
       and deleted_at is null`,
    [ingredientId, storeId],
  );

  return ingredient;
}
