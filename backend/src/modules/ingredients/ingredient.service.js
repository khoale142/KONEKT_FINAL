import { pool, query } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { toPublicIngredient } from '../../utils/ingredient.js';
import { provisionCatalogInventoryItem, synchronizeSafeBaseUnit } from '../inventory/inventory-catalog-provisioning.service.js';
import { CATEGORY_SCOPES, ensureCategoryIsUsable } from '../categories/category.service.js';

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeUnit(value) {
  return normalizeString(value);
}

function normalizeCategoryId(value) { return normalizeString(value) || null; }

function normalizeIngredientIds(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ApiError(400, 'At least one ingredient is required.');
  }

  const ingredientIds = value.map((item) => normalizeString(item));
  if (ingredientIds.some((ingredientId) => !ingredientId)) {
    throw new ApiError(400, 'Ingredient ID is invalid.');
  }

  if (new Set(ingredientIds).size !== ingredientIds.length) {
    throw new ApiError(400, 'Duplicate ingredient IDs are not allowed.');
  }

  return ingredientIds;
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
  if (!unit) {
    throw new ApiError(400, 'Ingredient unit is required.');
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

async function findIngredientRowById(ingredientId, storeId) {
  const result = await query(
    `select i.id,
            i.name,
            i.category_id,
            c.name as category_name,
            c.scope as category_scope,
            i.unit,
            i.current_stock,
            i.low_stock_threshold,
            i.is_preparation,
            i.is_group,
            i.parent_ingredient_id,
            i.size_name,
            i.created_at,
            i.updated_at,
            (i.current_stock <= i.low_stock_threshold) as is_low_stock
     from ingredients i
     left join categories c on c.id = i.category_id and c.store_id = i.store_id and c.deleted_at is null
     where i.id = $1
       and i.store_id = $2
       and i.deleted_at is null
     limit 1`,
    [ingredientId, storeId],
  );

  return result.rows[0] || null;
}

async function ensureUniqueIngredientName(name, storeId, excludeIngredientId = null, executor = { query }) {
  const params = [name, storeId];
  const conditions = ['lower(name) = lower($1)', 'store_id = $2', 'deleted_at is null'];

  if (excludeIngredientId) {
    params.push(excludeIngredientId);
    conditions.push(`id <> $${params.length}`);
  }

  const result = await executor.query(
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

export async function listIngredients({ search = '', lowStock, categoryId } = {}, storeId) {
  const params = [storeId];
  const conditions = ['i.store_id = $1', 'i.deleted_at is null'];
  const normalizedSearch = normalizeString(search);
  const isLowStockOnly = String(lowStock).toLowerCase() === 'true';
  const normalizedCategoryId = normalizeCategoryId(categoryId);

  if (normalizedSearch) {
    params.push(`%${normalizedSearch}%`);
    conditions.push(`i.name ilike $${params.length}`);
  }

  if (isLowStockOnly) {
    conditions.push('i.current_stock <= i.low_stock_threshold');
  }

  if (normalizedCategoryId && normalizedCategoryId !== 'ALL') {
    params.push(normalizedCategoryId);
    conditions.push(`i.category_id = $${params.length}`);
  }

  const result = await query(
    `select i.id,
            i.name,
            i.category_id,
            c.name as category_name,
            c.scope as category_scope,
            i.unit,
            i.current_stock,
            i.low_stock_threshold,
            i.is_preparation,
            i.is_group,
            i.parent_ingredient_id,
            i.size_name,
            i.created_at,
            i.updated_at,
            (i.current_stock <= i.low_stock_threshold) as is_low_stock
     from ingredients i
     left join categories c on c.id = i.category_id and c.store_id = i.store_id and c.deleted_at is null
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
  const categoryId = normalizeCategoryId(payload.categoryId ?? payload.category_id);
  const unit = normalizeUnit(payload.unit);
  const lowStockThreshold = ensureNonNegativeNumber(
    payload.lowStockThreshold ?? payload.low_stock_threshold ?? 0,
    'Low stock threshold',
  );
  const isPreparation = Boolean(payload.isPreparation ?? payload.is_preparation ?? false);

  ensureValidName(name);
  ensureValidUnit(unit);
  await ensureUniqueIngredientName(name, storeId);
  await ensureCategoryIsUsable(
    { query },
    categoryId,
    storeId,
    isPreparation ? CATEGORY_SCOPES.PREPARATION : CATEGORY_SCOPES.INGREDIENT,
  );

  const client = await pool.connect();
  try {
  await client.query('begin');
  const result = await client.query(
    `insert into ingredients (name, category_id, unit, current_stock, low_stock_threshold, is_preparation, created_by, store_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning id`,
    [name, categoryId, unit, 0, lowStockThreshold, isPreparation, actorUser.id, storeId],
  );

  await provisionCatalogInventoryItem(client, { storeId, catalogId: result.rows[0].id, itemType: isPreparation ? 'PREPARATION' : 'RAW_INGREDIENT', unit, lowStockThreshold });
  await client.query('commit');
  return getIngredientById(result.rows[0].id, storeId);
  } catch (error) { await client.query('rollback'); throw error; } finally { client.release(); }
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
  const nextCategoryId =
    payload.categoryId === undefined && payload.category_id === undefined
      ? existingIngredient.category_id
      : normalizeCategoryId(payload.categoryId ?? payload.category_id);
  const nextUnit =
    payload.unit === undefined ? existingIngredient.unit : normalizeUnit(payload.unit);
  const nextLowStockThreshold =
    payload.lowStockThreshold === undefined && payload.low_stock_threshold === undefined
      ? Number(existingIngredient.low_stock_threshold)
      : ensureNonNegativeNumber(
          payload.lowStockThreshold ?? payload.low_stock_threshold,
          'Low stock threshold',
        );
  const nextIsPreparation =
    payload.isPreparation === undefined && payload.is_preparation === undefined
      ? Boolean(existingIngredient.is_preparation)
      : Boolean(payload.isPreparation ?? payload.is_preparation);

  ensureValidName(nextName);
  ensureValidUnit(nextUnit);
  await ensureUniqueIngredientName(nextName, storeId, existingIngredient.id);
  await ensureCategoryIsUsable(
    { query },
    nextCategoryId,
    storeId,
    nextIsPreparation ? CATEGORY_SCOPES.PREPARATION : CATEGORY_SCOPES.INGREDIENT,
  );

  const client = await pool.connect();
  try {
  await client.query('begin');
  if (nextUnit !== existingIngredient.unit) {
    const inventory = await client.query('select id from inventory_items where ingredient_id=$1 and store_id=$2', [ingredientId, storeId]);
    if (inventory.rows[0]) await synchronizeSafeBaseUnit(client, { storeId, inventoryItemId: inventory.rows[0].id, nextUnit, ingredientId });
  }
  await client.query(
    `update ingredients
     set name = $1,
         category_id = $2,
         unit = $3,
         low_stock_threshold = $4,
         is_preparation = $5,
         updated_at = now()
     where id = $6
       and store_id = $7
       and deleted_at is null`,
    [nextName, nextCategoryId, nextUnit, nextLowStockThreshold, nextIsPreparation, ingredientId, storeId],
  );

  await client.query('commit');
  return getIngredientById(ingredientId, storeId);
  } catch (error) { await client.query('rollback'); throw error; } finally { client.release(); }
}

export async function assignIngredientsToCategory(payload, storeId) {
  const ingredientIds = normalizeIngredientIds(payload.ingredientIds ?? payload.ingredient_ids);
  const categoryId = normalizeCategoryId(payload.categoryId ?? payload.category_id);
  const isPreparation = Boolean(payload.isPreparation ?? payload.is_preparation);
  const requiredScope = isPreparation
    ? CATEGORY_SCOPES.PREPARATION
    : CATEGORY_SCOPES.INGREDIENT;
  const client = await pool.connect();

  try {
    await client.query('begin');
    await ensureCategoryIsUsable(
      { query: client.query.bind(client) },
      categoryId,
      storeId,
      requiredScope,
    );

    const ingredientsResult = await client.query(
      `select id
       from ingredients
       where id = any($1::uuid[])
         and store_id = $2
         and is_preparation = $3
         and deleted_at is null
       for update`,
      [ingredientIds, storeId, isPreparation],
    );

    if (ingredientsResult.rows.length !== ingredientIds.length) {
      throw new ApiError(404, `One or more ${isPreparation ? 'preparations' : 'raw ingredients'} were not found in this store.`);
    }

    await client.query(
      `update ingredients
       set category_id = $1,
           updated_at = now()
       where id = any($2::uuid[])
         and store_id = $3
         and deleted_at is null`,
      [categoryId, ingredientIds, storeId],
    );

    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }

  return Promise.all(ingredientIds.map((ingredientId) => getIngredientById(ingredientId, storeId)));
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

// Recipe Management for Preparations

function normalizeRecipeItems(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const ingredientIds = new Set();

  return value.map((item, index) => {
    const ingredientId = normalizeString(item?.ingredientId ?? item?.ingredient_id);
    const quantity = Number(item?.quantity);

    if (!ingredientId) {
      throw new ApiError(400, `Ingredient at row ${index + 1} is required.`);
    }

    if (!Number.isFinite(quantity) || quantity < 0) {
      throw new ApiError(400, `Ingredient quantity at row ${index + 1} cannot be negative.`);
    }

    if (ingredientIds.has(ingredientId)) {
      throw new ApiError(400, 'Duplicate ingredient lines are not allowed.');
    }

    ingredientIds.add(ingredientId);
    return { ingredientId, quantity };
  });
}

async function ensureRecipeIngredientsExist(client, recipeItems, storeId) {
  if (recipeItems.length === 0) return;

  const ingredientIds = recipeItems.map((item) => item.ingredientId);
  const result = await client.query(
    `select id
     from ingredients
     where id = any($1::uuid[])
       and store_id = $2
       and deleted_at is null`,
    [ingredientIds, storeId],
  );

  if (result.rows.length !== ingredientIds.length) {
    throw new ApiError(404, 'One or more recipe ingredients were not found in this store.');
  }
}

async function insertRecipeItems(client, recipeId, recipeItems) {
  for (const item of recipeItems) {
    await client.query(
      `insert into recipe_items (recipe_id, ingredient_id, quantity_required)
       values ($1, $2, $3)`,
      [recipeId, item.ingredientId, item.quantity],
    );
  }
}

export async function getIngredientRecipe(ingredientId, storeId) {
  const headerResult = await query(
    `select id, yield_amount
     from recipes
     where ingredient_id = $1
       and store_id = $2
       and deleted_at is null
     limit 1`,
    [ingredientId, storeId],
  );
  
  const recipe = headerResult.rows[0];
  if (!recipe) return null;

  const itemsResult = await query(
    `select ri.ingredient_id, ri.quantity_required, i.name as ingredient_name, i.unit
     from recipe_items ri
     join ingredients i on i.id = ri.ingredient_id
     where ri.recipe_id = $1
       and i.store_id = $2
       and i.deleted_at is null
     order by i.name asc`,
    [recipe.id, storeId],
  );

  return {
    id: recipe.id,
    yieldAmount: Number(recipe.yield_amount),
    items: itemsResult.rows.map((item) => ({
      ingredientId: item.ingredient_id,
      ingredientName: item.ingredient_name,
      unit: item.unit,
      quantity: Number(item.quantity_required),
    })),
  };
}

function normalizePreparationPayload(payload) {
  const name = normalizeString(payload.name);
  const categoryId = normalizeCategoryId(payload.categoryId ?? payload.category_id);
  const unit = normalizeUnit(payload.unit);
  const yieldAmount = Number(payload.yieldAmount ?? payload.yield_amount);
  const recipeItems = normalizeRecipeItems(payload.recipeItems ?? payload.recipe_items);

  ensureValidName(name);
  ensureValidUnit(unit);
  if (!Number.isFinite(yieldAmount) || yieldAmount <= 0) {
    throw new ApiError(400, 'Preparation yield amount must be greater than 0.');
  }
  if (!Array.isArray(payload.recipeItems ?? payload.recipe_items)) {
    throw new ApiError(400, 'Preparation recipe items are required.');
  }
  if (!recipeItems.some((item) => item.quantity > 0)) {
    throw new ApiError(400, 'Preparation recipe must include at least one component with quantity greater than 0.');
  }

  return { name, categoryId, unit, yieldAmount, recipeItems };
}

async function ensurePreparationComponentsExist(client, recipeItems, storeId) {
  const ingredientIds = recipeItems.map((item) => item.ingredientId);
  const result = await client.query(
    `select id, is_preparation
     from ingredients
     where id = any($1::uuid[])
       and store_id = $2
       and deleted_at is null`,
    [ingredientIds, storeId],
  );

  if (result.rows.length !== ingredientIds.length) {
    throw new ApiError(400, 'Preparation components must be active ingredients from the current store.');
  }

  return new Map(result.rows.map((row) => [String(row.id), Boolean(row.is_preparation)]));
}

async function loadPreparationDependencyIds(client, preparationId, storeId) {
  const headersResult = await client.query(
    `select id
     from recipes
     where ingredient_id = $1
       and store_id = $2
       and deleted_at is null
     order by id
     for update`,
    [preparationId, storeId],
  );

  if (headersResult.rows.length > 1) {
    throw new ApiError(409, `Preparation ${preparationId} has multiple active recipes.`);
  }
  if (headersResult.rows.length === 0) return [];

  const itemsResult = await client.query(
    `select ri.ingredient_id
     from recipe_items ri
     join ingredients component
       on component.id = ri.ingredient_id
      and component.store_id = $2
      and component.deleted_at is null
     where ri.recipe_id = $1`,
    [headersResult.rows[0].id, storeId],
  );

  return itemsResult.rows.map((row) => String(row.ingredient_id));
}

export async function validatePreparationRecipeGraph(client, storeId, targetPreparationId, submittedRecipeItems) {
  const targetId = String(targetPreparationId);
  const proposedDependencyIds = submittedRecipeItems.map((item) => String(item.ingredientId));
  const preparationFlags = await ensurePreparationComponentsExist(client, submittedRecipeItems, storeId);

  if (proposedDependencyIds.includes(targetId)) {
    throw new ApiError(400, 'A preparation cannot include itself in its recipe.');
  }

  async function visit(nodeId, path) {
    if (path.has(nodeId)) {
      throw new ApiError(400, `Preparation recipe cycle detected: ${[...path, nodeId].join(' -> ')}.`);
    }

    const nextPath = new Set(path);
    nextPath.add(nodeId);
    const dependencyIds = nodeId === targetId
      ? proposedDependencyIds
      : await loadPreparationDependencyIds(client, nodeId, storeId);

    for (const dependencyId of dependencyIds) {
      if (dependencyId === targetId) {
        throw new ApiError(400, 'Preparation recipe cannot create a cycle back to itself.');
      }

      let isPreparation = preparationFlags.get(dependencyId);
      if (isPreparation === undefined) {
        const componentResult = await client.query(
          `select is_preparation
           from ingredients
           where id = $1
             and store_id = $2
             and deleted_at is null`,
          [dependencyId, storeId],
        );
        if (!componentResult.rows[0]) {
          throw new ApiError(400, 'Preparation graph contains an inactive or cross-store component.');
        }
        isPreparation = Boolean(componentResult.rows[0].is_preparation);
        preparationFlags.set(dependencyId, isPreparation);
      }

      if (isPreparation) {
        await visit(dependencyId, nextPath);
      }
    }
  }

  await visit(targetId, new Set());
}

async function getPreparationRecipeHeaderForUpdate(client, preparationId, storeId) {
  const result = await client.query(
    `select id, deleted_at
     from recipes
     where ingredient_id = $1
       and store_id = $2
     order by id
     for update`,
    [preparationId, storeId],
  );

  if (result.rows.length > 1) {
    throw new ApiError(409, 'A preparation cannot have multiple recipe headers.');
  }

  return result.rows[0] || null;
}

async function replaceAtomicPreparationRecipe(client, preparationId, actorUserId, storeId, yieldAmount, recipeItems) {
  const existingRecipe = await getPreparationRecipeHeaderForUpdate(client, preparationId, storeId);

  if (existingRecipe) {
    await client.query('delete from recipe_items where recipe_id = $1', [existingRecipe.id]);
    await insertRecipeItems(client, existingRecipe.id, recipeItems);
    await client.query(
      `update recipes
       set product_id = null,
           ingredient_id = $1,
           yield_amount = $2,
           deleted_at = null,
           updated_at = now()
       where id = $3
         and store_id = $4`,
      [preparationId, yieldAmount, existingRecipe.id, storeId],
    );
    return;
  }

  const result = await client.query(
    `insert into recipes (product_id, ingredient_id, yield_amount, created_by, store_id)
     values (null, $1, $2, $3, $4)
     returning id`,
    [preparationId, yieldAmount, actorUserId, storeId],
  );
  await insertRecipeItems(client, result.rows[0].id, recipeItems);
}

async function loadAtomicPreparation(preparationId, storeId) {
  const preparation = await getIngredientById(preparationId, storeId);
  if (!preparation.isPreparation) {
    throw new ApiError(400, 'Ingredient is not a preparation.');
  }

  return {
    preparation,
    recipe: await getIngredientRecipe(preparationId, storeId),
  };
}

async function insertCompletedPreparation(client, payload, actorUser, storeId) {
  const { name, categoryId, unit, yieldAmount, recipeItems } = normalizePreparationPayload(payload);
  await ensureUniqueIngredientName(name, storeId, null, client);
  await ensureCategoryIsUsable(client, categoryId, storeId, CATEGORY_SCOPES.PREPARATION);
  const result = await client.query(
    `insert into ingredients (name, category_id, unit, current_stock, low_stock_threshold, is_preparation, created_by, store_id)
     values ($1, $2, $3, 0, 0, true, $4, $5)
     returning id`,
    [name, categoryId, unit, actorUser.id, storeId],
  );
  const preparationId = result.rows[0].id;
  await provisionCatalogInventoryItem(client, { storeId, catalogId: preparationId, itemType: 'PREPARATION', unit, lowStockThreshold: 0 });
  await validatePreparationRecipeGraph(client, storeId, preparationId, recipeItems);
  await replaceAtomicPreparationRecipe(client, preparationId, actorUser.id, storeId, yieldAmount, recipeItems);
  return preparationId;
}

export async function createPreparation(payload, actorUser, storeId) {
  const client = await pool.connect();
  let preparationId;

  try {
    await client.query('begin');
    preparationId = await insertCompletedPreparation(client, payload, actorUser, storeId);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }

  return loadAtomicPreparation(preparationId, storeId);
}

export async function createBulkCompletedPreparations(payload, actorUser, storeId) {
  const items = Array.isArray(payload) ? payload : payload?.items;
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'Preparation batch must contain at least one item.');
  }
  const client = await pool.connect();
  let ids = [];
  try {
    await client.query('begin');
    for (const item of items) ids.push(await insertCompletedPreparation(client, item, actorUser, storeId));
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally { client.release(); }
  return Promise.all(ids.map((id) => loadAtomicPreparation(id, storeId)));
}

export async function updatePreparation(preparationId, payload, actorUser, storeId) {
  const { name, categoryId, unit, yieldAmount, recipeItems } = normalizePreparationPayload(payload);
  const client = await pool.connect();

  try {
    await client.query('begin');
    const preparationResult = await client.query(
      `select id
       from ingredients
       where id = $1
         and store_id = $2
         and deleted_at is null
         and is_preparation = true
       for update`,
      [preparationId, storeId],
    );
    if (!preparationResult.rows[0]) {
      throw new ApiError(404, 'Preparation not found.');
    }

    await ensureUniqueIngredientName(name, storeId, preparationId, client);
    await ensureCategoryIsUsable(client, categoryId, storeId, CATEGORY_SCOPES.PREPARATION);
    await ensurePreparationComponentsExist(client, recipeItems, storeId);
    await validatePreparationRecipeGraph(client, storeId, preparationId, recipeItems);

    await client.query(
      `update ingredients
       set name = $1,
           category_id = $2,
           unit = $3,
           is_preparation = true,
           updated_at = now()
       where id = $4
         and store_id = $5`,
      [name, categoryId, unit, preparationId, storeId],
    );
    await replaceAtomicPreparationRecipe(client, preparationId, actorUser.id, storeId, yieldAmount, recipeItems);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }

  return loadAtomicPreparation(preparationId, storeId);
}

export async function replaceIngredientRecipe(client, ingredientId, actorUserId, storeId, recipePayload) {
  const yieldAmount = Number(recipePayload.yieldAmount ?? recipePayload.yield_amount ?? 1);
  if (!Number.isFinite(yieldAmount) || yieldAmount <= 0) {
    throw new ApiError(400, 'Yield amount must be greater than 0.');
  }
  
  const recipeItems = normalizeRecipeItems(recipePayload.items || []);
  
  const ingredient = await findIngredientRowById(ingredientId, storeId);
  if (!ingredient || !ingredient.is_preparation) {
    throw new ApiError(400, 'Only preparations can have recipes.');
  }

  // Ensure ingredients exist
  if (recipeItems.length > 0) {
    const itemIds = recipeItems.map((item) => item.ingredientId);
    const result = await client.query(
      `select id
       from ingredients
       where id = any($1::uuid[])
         and store_id = $2
         and deleted_at is null`,
      [itemIds, storeId],
    );

    if (result.rows.length !== itemIds.length) {
      throw new ApiError(404, 'One or more recipe ingredients were not found in this store.');
    }
  }

  const recipeResult = await client.query(
    `select id, deleted_at
     from recipes
     where ingredient_id = $1
       and store_id = $2
     limit 1
     for update`,
    [ingredientId, storeId],
  );
  
  const existingRecipe = recipeResult.rows[0];

  if (existingRecipe) {
    if (recipeItems.length === 0) {
      if (!existingRecipe.deleted_at) {
        await client.query(
          `update recipes
           set deleted_at = now(), updated_at = now()
           where id = $1 and store_id = $2`,
          [existingRecipe.id, storeId],
        );
      }
      return;
    }

    await client.query('delete from recipe_items where recipe_id = $1', [existingRecipe.id]);
    for (const item of recipeItems) {
      await client.query(
        `insert into recipe_items (recipe_id, ingredient_id, quantity_required)
         values ($1, $2, $3)`,
        [existingRecipe.id, item.ingredientId, item.quantity],
      );
    }
    
    await client.query(
      'update recipes set deleted_at = null, updated_at = now(), yield_amount = $1 where id = $2 and store_id = $3',
      [yieldAmount, existingRecipe.id, storeId],
    );
    return;
  }

  if (recipeItems.length === 0) return;

  const createdRecipe = await client.query(
    `insert into recipes (ingredient_id, created_by, store_id, yield_amount)
     values ($1, $2, $3, $4)
     returning id`,
    [ingredientId, actorUserId, storeId, yieldAmount],
  );
  
  const newRecipeId = createdRecipe.rows[0].id;
  for (const item of recipeItems) {
    await client.query(
      `insert into recipe_items (recipe_id, ingredient_id, quantity_required)
       values ($1, $2, $3)`,
      [newRecipeId, item.ingredientId, item.quantity],
    );
  }
}

export async function createBulkIngredients(payloadArray, actorUser, storeId) {
  if (!Array.isArray(payloadArray) || payloadArray.length === 0) {
    throw new ApiError(400, 'Payload must be a non-empty array.');
  }

  const client = await pool.connect();
  try {
    await client.query('begin');
    const createdIds = [];

    for (const item of payloadArray) {
      const name = normalizeString(item.name);
      const categoryId = normalizeCategoryId(item.categoryId ?? item.category_id);
      const unit = normalizeUnit(item.unit);
      const lowStockThreshold = ensureNonNegativeNumber(
        item.lowStockThreshold ?? item.low_stock_threshold ?? 0,
        'Low stock threshold',
      );
      const isPreparation = Boolean(item.isPreparation ?? item.is_preparation ?? false);

      ensureValidName(name);
      ensureValidUnit(unit);
      
      if (categoryId) {
        await ensureCategoryIsUsable(
          { query: client.query.bind(client) }, 
          categoryId, 
          storeId, 
          isPreparation ? CATEGORY_SCOPES.PREPARATION : CATEGORY_SCOPES.INGREDIENT
        );
      }

      if (item.sizes && Array.isArray(item.sizes) && item.sizes.length > 0) {
        await ensureUniqueIngredientName(name, storeId);
        
        const parentResult = await client.query(
          `insert into ingredients (name, category_id, unit, current_stock, low_stock_threshold, is_preparation, is_group, created_by, store_id)
           values ($1, $2, $3, $4, $5, $6, true, $7, $8)
           returning id`,
          [name, categoryId, unit, 0, lowStockThreshold, isPreparation, actorUser.id, storeId]
        );
        const parentId = parentResult.rows[0].id;
        
        for (const size of item.sizes) {
          const sizeName = normalizeString(size.sizeName);
          const childName = `${name} - Size ${sizeName}`;
          const recipeItems = isPreparation ? normalizeRecipeItems(size.recipeItems || []) : [];
          const yieldAmount = Number(size.yieldAmount || 1);
          
          ensureValidName(sizeName);
          await ensureUniqueIngredientName(childName, storeId);
          
          const childResult = await client.query(
            `insert into ingredients (name, category_id, unit, current_stock, low_stock_threshold, is_preparation, is_group, parent_ingredient_id, size_name, created_by, store_id)
             values ($1, $2, $3, $4, $5, $6, false, $7, $8, $9, $10)
             returning id`,
            [childName, categoryId, unit, 0, lowStockThreshold, isPreparation, parentId, sizeName, actorUser.id, storeId]
          );
          await provisionCatalogInventoryItem(client, { storeId, catalogId: childResult.rows[0].id, itemType: isPreparation ? 'PREPARATION' : 'RAW_INGREDIENT', unit, lowStockThreshold });
          
          if (isPreparation && recipeItems.length > 0) {
            await ensureRecipeIngredientsExist(client, recipeItems, storeId);
            const createdRecipe = await client.query(
              `insert into recipes (ingredient_id, yield_amount, created_by, store_id)
               values ($1, $2, $3, $4)
               returning id`,
              [childResult.rows[0].id, yieldAmount, actorUser.id, storeId]
            );
            await insertRecipeItems(client, createdRecipe.rows[0].id, recipeItems);
          }
        }
        
        createdIds.push(parentId);
      } else {
        await ensureUniqueIngredientName(name, storeId);
        const result = await client.query(
          `insert into ingredients (name, category_id, unit, current_stock, low_stock_threshold, is_preparation, created_by, store_id)
           values ($1, $2, $3, $4, $5, $6, $7, $8)
           returning id`,
          [name, categoryId, unit, 0, lowStockThreshold, isPreparation, actorUser.id, storeId]
        );
        await provisionCatalogInventoryItem(client, { storeId, catalogId: result.rows[0].id, itemType: isPreparation ? 'PREPARATION' : 'RAW_INGREDIENT', unit, lowStockThreshold });
        
        if (isPreparation) {
          const recipeItems = normalizeRecipeItems(item.recipeItems || []);
          const yieldAmount = Number(item.yieldAmount || 1);
          if (recipeItems.length > 0) {
            await ensureRecipeIngredientsExist(client, recipeItems, storeId);
            const createdRecipe = await client.query(
              `insert into recipes (ingredient_id, yield_amount, created_by, store_id)
               values ($1, $2, $3, $4)
               returning id`,
              [result.rows[0].id, yieldAmount, actorUser.id, storeId]
            );
            await insertRecipeItems(client, createdRecipe.rows[0].id, recipeItems);
          }
        }
        createdIds.push(result.rows[0].id);
      }
    }

    await client.query('commit');
    
    const createdIngredients = [];
    for (const id of createdIds) {
       createdIngredients.push(await getIngredientById(id, storeId));
    }
    return createdIngredients;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
