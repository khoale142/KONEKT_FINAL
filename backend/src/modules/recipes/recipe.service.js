import { pool, query } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { toPublicRecipe } from '../../utils/recipe.js';

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeId(value, fieldName) {
  const normalizedValue =
    typeof value === 'string' ? value.trim() : String(value ?? '').trim();

  if (!normalizedValue) {
    throw new ApiError(400, `${fieldName} is invalid.`);
  }

  return normalizedValue;
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

function normalizeRecipeItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'Recipe must contain at least one ingredient item.');
  }

  const seenIngredientIds = new Set();

  return items.map((item, index) => {
    const ingredientId = normalizeId(
      item?.ingredientId ?? item?.ingredient_id,
      `Ingredient id at row ${index + 1}`,
    );
    const quantity = ensureNonNegativeNumber(item?.quantity, `Quantity at row ${index + 1}`);

    if (seenIngredientIds.has(ingredientId)) {
      throw new ApiError(400, 'Duplicate ingredient lines are not allowed in one recipe.');
    }

    seenIngredientIds.add(ingredientId);

    return {
      ingredientId,
      quantity,
    };
  });
}

async function findProductRowById(productId, storeId) {
  const result = await query(
    `select id,
            name,
            status,
            price,
            is_group,
            parent_product_id
     from products
     where id = $1
       and store_id = $2
       and deleted_at is null
     limit 1`,
    [productId, storeId],
  );

  return result.rows[0] || null;
}

async function ensureProductExists(productId, storeId) {
  const product = await findProductRowById(productId, storeId);

  if (!product) {
    throw new ApiError(404, 'Product not found.');
  }

  return product;
}

async function ensureIngredientsExist(ingredientIds, storeId) {
  const placeholders = ingredientIds.map((_, index) => `$${index + 1}`).join(', ');
  const params = [...ingredientIds, storeId];
  
  const result = await query(
    `select id,
            name,
            unit
     from ingredients
     where id in (${placeholders})
       and store_id = $${params.length}
       and deleted_at is null`,
    params,
  );

  if (result.rows.length !== ingredientIds.length) {
    throw new ApiError(404, 'One or more ingredients were not found.');
  }

  return result.rows;
}

async function findRecipeHeaderById(recipeId, storeId) {
  const result = await query(
    `select r.id,
            r.product_id,
            p.name as product_name,
            p.status as product_status,
            p.price as product_price,
            p.is_group as product_is_group,
            r.created_at,
            r.updated_at
     from recipes r
     join products p on p.id = r.product_id
     where r.id = $1
       and r.store_id = $2
       and r.deleted_at is null
       and p.deleted_at is null
     limit 1`,
    [recipeId, storeId],
  );

  return result.rows[0] || null;
}

async function findRecipeHeaderByProductId(productId, storeId) {
  const result = await query(
    `select r.id,
            r.product_id,
            p.name as product_name,
            p.status as product_status,
            p.price as product_price,
            p.is_group as product_is_group,
            r.created_at,
            r.updated_at
     from recipes r
     join products p on p.id = r.product_id
     where r.product_id = $1
       and r.store_id = $2
       and r.deleted_at is null
       and p.deleted_at is null
     limit 1`,
    [productId, storeId],
  );

  return result.rows[0] || null;
}

async function ensureRecipeDoesNotExistForProduct(productId, storeId, excludeRecipeId = null) {
  const params = [productId, storeId];
  const conditions = ['product_id = $1', 'store_id = $2', 'deleted_at is null'];

  if (excludeRecipeId) {
    params.push(excludeRecipeId);
    conditions.push(`id <> $${params.length}`);
  }

  const result = await query(
    `select id
     from recipes
     where ${conditions.join(' and ')}
     limit 1`,
    params,
  );

  if (result.rows[0]) {
    throw new ApiError(409, 'This product already has a recipe.');
  }
}

async function getRecipeForUpdate(client, recipeId, storeId) {
  const result = await client.query(
    `select r.id,
            r.product_id,
            p.name as product_name,
            p.status as product_status,
            p.price as product_price,
            p.is_group as product_is_group,
            r.created_at,
            r.updated_at
     from recipes r
     join products p on p.id = r.product_id
     where r.id = $1
       and r.store_id = $2
       and r.deleted_at is null
       and p.deleted_at is null
     limit 1
     for update of r`,
    [recipeId, storeId],
  );

  return result.rows[0] || null;
}

async function loadRecipeItemRows(recipeIds) {
  if (!recipeIds.length) {
    return [];
  }

  const placeholders = recipeIds.map((_, index) => `$${index + 1}`).join(', ');
  const result = await query(
    `select ri.recipe_id,
            ri.ingredient_id,
            ri.quantity_required,
            i.name as ingredient_name,
            i.unit
     from recipe_items ri
     join ingredients i on i.id = ri.ingredient_id
     where ri.recipe_id in (${placeholders})
       and i.deleted_at is null
     order by ri.recipe_id asc, i.name asc`,
    recipeIds,
  );

  return result.rows;
}

function groupItemsByRecipeId(itemRows) {
  const itemMap = new Map();

  for (const row of itemRows) {
    if (!itemMap.has(row.recipe_id)) {
      itemMap.set(row.recipe_id, []);
    }

    itemMap.get(row.recipe_id).push(row);
  }

  return itemMap;
}

async function buildRecipesFromHeaders(headers) {
  if (!headers.length) {
    return [];
  }

  const itemRows = await loadRecipeItemRows(headers.map((header) => header.id));
  const itemMap = groupItemsByRecipeId(itemRows);

  return headers.map((header) => toPublicRecipe(header, itemMap.get(header.id) || []));
}

async function insertRecipeItems(client, recipeId, items) {
  for (const item of items) {
    await client.query(
      `insert into recipe_items (recipe_id, ingredient_id, quantity_required)
       values ($1, $2, $3)`,
      [recipeId, item.ingredientId, item.quantity],
    );
  }
}

export async function listRecipes({ search = '' } = {}, storeId) {
  const normalizedSearch = normalizeString(search);
  const params = [storeId];
  const conditions = ['r.store_id = $1', 'r.deleted_at is null', 'p.deleted_at is null'];

  if (normalizedSearch) {
    params.push(`%${normalizedSearch}%`);
    conditions.push(`p.name ilike $${params.length}`);
  }

  const result = await query(
    `select r.id,
            r.product_id,
            p.name as product_name,
            p.status as product_status,
            p.price as product_price,
            r.created_at,
            r.updated_at
     from recipes r
     join products p on p.id = r.product_id
     where ${conditions.join(' and ')}
     order by p.name asc, r.created_at desc`,
    params,
  );

  return buildRecipesFromHeaders(result.rows);
}

export async function getRecipeById(recipeId, storeId) {
  const normalizedRecipeId = normalizeId(recipeId, 'Recipe id');
  const header = await findRecipeHeaderById(normalizedRecipeId, storeId);

  if (!header) {
    throw new ApiError(404, 'Recipe not found.');
  }

  const [recipe] = await buildRecipesFromHeaders([header]);
  return recipe;
}

export async function getRecipeByProductId(productId, storeId) {
  const normalizedProductId = normalizeId(productId, 'Product id');
  await ensureProductExists(normalizedProductId, storeId);

  const header = await findRecipeHeaderByProductId(normalizedProductId, storeId);

  if (!header) {
    throw new ApiError(404, 'Recipe not found.');
  }

  const [recipe] = await buildRecipesFromHeaders([header]);
  return recipe;
}

export async function createRecipe(payload, actorUser, storeId) {
  const productId = normalizeId(payload.productId ?? payload.product_id, 'Product id');
  const items = normalizeRecipeItems(payload.items);

  const product = await ensureProductExists(productId, storeId);
  if (product.is_group) {
    throw new ApiError(400, 'A size group cannot own a sellable recipe. Create the recipe on a size instead.');
  }
  await ensureRecipeDoesNotExistForProduct(productId, storeId);
  await ensureIngredientsExist(items.map((item) => item.ingredientId), storeId);

  const client = await pool.connect();

  try {
    await client.query('begin');

    const insertRecipeResult = await client.query(
      `insert into recipes (product_id, created_by, store_id)
       values ($1, $2, $3)
       returning id`,
      [productId, actorUser.id, storeId],
    );

    await insertRecipeItems(client, insertRecipeResult.rows[0].id, items);

    await client.query('commit');

    return getRecipeById(insertRecipeResult.rows[0].id, storeId);
  } catch (error) {
    await client.query('rollback');

    if (error?.code === '23505') {
      throw new ApiError(409, 'This product already has a recipe.');
    }

    throw error;
  } finally {
    client.release();
  }
}

export async function updateRecipe(recipeId, payload, storeId) {
  const normalizedRecipeId = normalizeId(recipeId, 'Recipe id');
  const items = normalizeRecipeItems(payload.items);

  const client = await pool.connect();

  try {
    await client.query('begin');

    const existingRecipe = await getRecipeForUpdate(client, normalizedRecipeId, storeId);

    if (!existingRecipe) {
      throw new ApiError(404, 'Recipe not found.');
    }

    if (existingRecipe.product_is_group) {
      throw new ApiError(400, 'A size group recipe is retained only for legacy compatibility and cannot be edited.');
    }

    if (
      payload.productId !== undefined ||
      payload.product_id !== undefined
    ) {
      const requestedProductId = normalizeId(
        payload.productId ?? payload.product_id,
        'Product id',
      );

      if (requestedProductId !== String(existingRecipe.product_id)) {
        throw new ApiError(400, 'Recipe product cannot be changed.');
      }
    }

    await ensureIngredientsExist(items.map((item) => item.ingredientId), storeId);

    await client.query('delete from recipe_items where recipe_id = $1', [normalizedRecipeId]);
    await insertRecipeItems(client, normalizedRecipeId, items);

    await client.query(
      `update recipes
       set updated_at = now()
       where id = $1
         and store_id = $2
         and deleted_at is null`,
      [normalizedRecipeId, storeId],
    );

    await client.query('commit');

    return getRecipeById(normalizedRecipeId, storeId);
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function softDeleteRecipe(recipeId, storeId) {
  const normalizedRecipeId = normalizeId(recipeId, 'Recipe id');
  const header = await findRecipeHeaderById(normalizedRecipeId, storeId);
  if (!header) {
    throw new ApiError(404, 'Recipe not found.');
  }
  if (header.product_is_group) {
    throw new ApiError(400, 'A size group recipe is retained for legacy compatibility and cannot be deleted.');
  }
  const [recipe] = await buildRecipesFromHeaders([header]);

  await query(
    `update recipes
     set deleted_at = now(),
         updated_at = now()
     where id = $1
       and store_id = $2
       and deleted_at is null`,
    [normalizedRecipeId, storeId],
  );

  return recipe;
}
