import { pool, query } from '../../config/db.js';
import { PRODUCT_STATUS } from '../../constants/productStatus.js';
import { ApiError } from '../../utils/ApiError.js';
import { toPublicProduct } from '../../utils/product.js';
import { ensureCatalogInventoryProvisioned, provisionCatalogInventoryItem, synchronizeSafeBaseUnit } from '../inventory/inventory-catalog-provisioning.service.js';
import { CATEGORY_SCOPES, ensureCategoryIsUsable } from '../categories/category.service.js';

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStatus(value) {
  return normalizeString(value).toUpperCase();
}

function normalizeCategoryId(value) { return normalizeString(value) || null; }

function normalizeImageUrl(value) { return normalizeString(value) || null; }

function normalizeUnit(value) { return normalizeString(value); }

function normalizeId(value, fieldName) {
  const normalizedValue = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
  if (!normalizedValue) {
    throw new ApiError(400, `${fieldName} is invalid.`);
  }
  return normalizedValue;
}

function normalizeProductIds(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ApiError(400, 'At least one product is required.');
  }

  const ids = value.map((id) => normalizeId(id, 'Product ID'));
  if (new Set(ids).size !== ids.length) {
    throw new ApiError(400, 'Duplicate product IDs are not allowed.');
  }
  return ids;
}

function normalizeSortOrder(value, fieldName = 'Sort order') {
  const normalizedValue = Number(value);
  if (!Number.isInteger(normalizedValue) || normalizedValue < 0) {
    throw new ApiError(400, `${fieldName} must be a non-negative integer.`);
  }
  return normalizedValue;
}

function deriveVariantName(parentName, sizeName) {
  return `${parentName} - ${sizeName}`;
}

function ensureValidName(name) {
  if (!name) {
    throw new ApiError(400, 'Product name is required.');
  }

  if (name.length > 63) {
    throw new ApiError(400, 'Product name must not exceed 63 characters.');
  }
}

function ensureValidStatus(status) {
  if (![PRODUCT_STATUS.ACTIVE, PRODUCT_STATUS.INACTIVE].includes(status)) {
    throw new ApiError(400, 'Product status is invalid.');
  }
}

function ensureValidPrice(price) {
  if (price !== null && typeof price === 'object') {
    throw new ApiError(400, 'Product price must be a scalar number.');
  }

  const normalizedPrice = Number(price);

  if (!Number.isFinite(normalizedPrice)) {
    throw new ApiError(400, 'Product price is invalid.');
  }

  if (normalizedPrice <= 0) {
    throw new ApiError(400, 'Product price must be greater than 0.');
  }

  return normalizedPrice;
}

function ensureValidUnit(unit) {
  if (!unit) {
    throw new ApiError(400, 'Product unit is required.');
  }
}

function ensureValidImageUrl(imageUrl) {
  if (imageUrl && imageUrl.length > 500) {
    throw new ApiError(400, 'Product image URL must not exceed 500 characters.');
  }
}

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
  if (!recipeItems.length) return;

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

async function getRecipeDefinitionByProductId(productId, storeId) {
  const headerResult = await query(
    `select id
     from recipes
     where product_id = $1
       and store_id = $2
       and deleted_at is null
     limit 1`,
    [productId, storeId],
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
    items: itemsResult.rows.map((item) => ({
      ingredientId: item.ingredient_id,
      ingredientName: item.ingredient_name,
      unit: item.unit,
      quantity: Number(item.quantity_required),
    })),
  };
}

async function replaceProductRecipe(client, productId, actorUserId, storeId, recipeItems) {
  await ensureRecipeIngredientsExist(client, recipeItems, storeId);

  const recipeResult = await client.query(
    `select id, deleted_at
     from recipes
     where product_id = $1
       and store_id = $2
     limit 1
     for update`,
    [productId, storeId],
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
    await insertRecipeItems(client, existingRecipe.id, recipeItems);
    await client.query(
      'update recipes set deleted_at = null, updated_at = now() where id = $1 and store_id = $2',
      [existingRecipe.id, storeId],
    );
    return;
  }

  if (recipeItems.length === 0) return;

  const createdRecipe = await client.query(
    `insert into recipes (product_id, created_by, store_id)
     values ($1, $2, $3)
     returning id`,
    [productId, actorUserId, storeId],
  );
  await insertRecipeItems(client, createdRecipe.rows[0].id, recipeItems);
}

async function findProductRowById(productId, storeId) {
  const result = await query(
    `select p.id,
            p.name,
            p.category_id,
            c.name as category_name,
            c.scope as category_scope,
            p.image_url,
            p.price,
            p.unit,
            p.status,
            p.is_group,
            p.parent_product_id,
            p.size_name,
            p.sort_order,
            p.created_at,
            p.updated_at,
            inventory.product_inventory_mode,
            inventory.quantity_on_hand as inventory_quantity_on_hand,
            inventory.low_stock_threshold as inventory_low_stock_threshold,
            exists(
              select 1
              from recipes r
              join recipe_items ri on ri.recipe_id = r.id
              where r.product_id = p.id
                and r.store_id = p.store_id
                and r.deleted_at is null
            ) as has_recipe
     from products p
     left join categories c on c.id = p.category_id and c.store_id = p.store_id and c.deleted_at is null
     left join inventory_items inventory on inventory.product_id=p.id and inventory.store_id=p.store_id
     where p.id = $1
       and p.store_id = $2
       and p.deleted_at is null
     limit 1`,
    [productId, storeId],
  );

  return result.rows[0] || null;
}

async function listVariantsForParent(parentProductId, storeId) {
  const result = await query(
    `select p.id,
            p.name,
            p.category_id,
            c.name as category_name,
            c.scope as category_scope,
            p.image_url,
            p.price,
            p.unit,
            p.status,
            p.is_group,
            p.parent_product_id,
            p.size_name,
            p.sort_order,
            p.created_at,
            p.updated_at,
            inventory.product_inventory_mode,
            inventory.quantity_on_hand as inventory_quantity_on_hand,
            inventory.low_stock_threshold as inventory_low_stock_threshold,
            exists(
              select 1
              from recipes r
              join recipe_items ri on ri.recipe_id = r.id
              where r.product_id = p.id
                and r.store_id = p.store_id
                and r.deleted_at is null
            ) as has_recipe
     from products p
     left join categories c on c.id = p.category_id and c.store_id = p.store_id and c.deleted_at is null
     where p.parent_product_id = $1
       and p.store_id = $2
       and p.deleted_at is null
     order by p.sort_order asc nulls last, p.created_at asc`,
    [parentProductId, storeId],
  );

  return Promise.all(result.rows.map(async (row) => ({
    ...toPublicProduct(row),
    name: row.name,
    recipe: await getRecipeDefinitionByProductId(row.id, storeId),
  })));
}

async function toPublicProductDetails(row, storeId) {
  const product = {
    ...toPublicProduct(row),
    recipe: row.is_group ? null : await getRecipeDefinitionByProductId(row.id, storeId),
  };

  if (row.is_group) {
    product.variants = await listVariantsForParent(row.id, storeId);
  }

  return product;
}

async function ensureUniqueProductName(name, storeId, excludeProductId = null, executor = { query }) {
  const params = [name, storeId];
  const conditions = ['lower(name) = lower($1)', 'store_id = $2', 'deleted_at is null'];

  if (excludeProductId) {
    params.push(excludeProductId);
    conditions.push(`id <> $${params.length}`);
  }

  const result = await executor.query(
    `select id
     from products
     where ${conditions.join(' and ')}
     limit 1`,
    params,
  );

  if (result.rows[0]) {
    throw new ApiError(409, 'Product name already exists.');
  }
}

export async function listProducts({ search = '', status, categoryId } = {}, storeId) {
  const params = [storeId];
  const conditions = ['p.store_id = $1', 'p.deleted_at is null', 'p.parent_product_id is null'];
  const normalizedSearch = normalizeString(search);
  const normalizedStatus = normalizeStatus(status);
  const normalizedCategoryId = normalizeCategoryId(categoryId);

  if (normalizedSearch) {
    params.push(`%${normalizedSearch}%`);
    conditions.push(`p.name ilike $${params.length}`);
  }

  if (normalizedStatus && normalizedStatus !== 'ALL') {
    ensureValidStatus(normalizedStatus);
    params.push(normalizedStatus);
    conditions.push(`p.status = $${params.length}`);
  }

  if (normalizedCategoryId && normalizedCategoryId !== 'ALL') {
    params.push(normalizedCategoryId);
    conditions.push(`p.category_id = $${params.length}`);
  }

  const result = await query(
    `select p.id,
            p.name,
            p.category_id,
            c.name as category_name,
            c.scope as category_scope,
            p.image_url,
            p.price,
            p.unit,
            p.status,
            p.is_group,
            p.parent_product_id,
            p.size_name,
            p.sort_order,
            p.created_at,
            p.updated_at,
            exists(
              select 1
              from recipes r
              join recipe_items ri on ri.recipe_id = r.id
              where r.product_id = p.id
                and r.store_id = p.store_id
                and r.deleted_at is null
            ) as has_recipe
     from products p
     left join categories c on c.id = p.category_id and c.store_id = p.store_id and c.deleted_at is null
     where ${conditions.join(' and ')}
     order by p.created_at desc, p.name asc`,
    params,
  );

  return Promise.all(result.rows.map((row) => toPublicProductDetails(row, storeId)));
}

export async function getProductById(productId, storeId) {
  const product = await findProductRowById(productId, storeId);

  if (!product) {
    throw new ApiError(404, 'Product not found.');
  }

  return toPublicProductDetails(product, storeId);
}

export async function assignProductsToCategory(payload, storeId) {
  const productIds = normalizeProductIds(payload.productIds ?? payload.product_ids);
  const categoryId = normalizeCategoryId(payload.categoryId ?? payload.category_id);
  const client = await pool.connect();

  try {
    await client.query('begin');
    await ensureCategoryIsUsable(client, categoryId, storeId, CATEGORY_SCOPES.PRODUCT);
    const result = await client.query(
      `select id
       from products
       where id = any($1::uuid[])
         and store_id = $2
         and parent_product_id is null
         and deleted_at is null
       for update`,
      [productIds, storeId],
    );
    if (result.rows.length !== productIds.length) {
      throw new ApiError(404, 'One or more products were not found in this store.');
    }
    await client.query(
      `update products
       set category_id = $1, updated_at = now()
       where id = any($2::uuid[])
         and store_id = $3
         and parent_product_id is null
         and deleted_at is null`,
      [categoryId, productIds, storeId],
    );
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }

  return Promise.all(productIds.map((productId) => getProductById(productId, storeId)));
}

export async function createProduct(payload, actorUser, storeId) {
  const name = normalizeString(payload.name);
  const categoryId = normalizeCategoryId(payload.categoryId ?? payload.category_id);
  const imageUrl = normalizeImageUrl(payload.imageUrl ?? payload.image_url);
  const unit = normalizeUnit(payload.unit);
  const price = ensureValidPrice(payload.price);
  const status = normalizeStatus(payload.status || PRODUCT_STATUS.ACTIVE);
  const recipeItems = normalizeRecipeItems(payload.recipeItems);

  ensureValidName(name);
  ensureValidStatus(status);
  ensureValidImageUrl(imageUrl);
  ensureValidUnit(unit);

  await ensureUniqueProductName(name, storeId);

  const client = await pool.connect();
  try {
    await client.query('begin');
    await ensureCategoryIsUsable(client, categoryId, storeId, CATEGORY_SCOPES.PRODUCT);
    const result = await client.query(
      `insert into products (name, category_id, image_url, price, unit, status, created_by, store_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning id`,
      [name, categoryId, imageUrl, price, unit, status, actorUser.id, storeId],
    );

    await provisionCatalogInventoryItem(client, { storeId, catalogId: result.rows[0].id, itemType: 'PRODUCT', unit });

    await replaceProductRecipe(client, result.rows[0].id, actorUser.id, storeId, recipeItems);
    await client.query('commit');
    return getProductById(result.rows[0].id, storeId);
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateProduct(productId, payload, actorUser, storeId) {
  const existingProduct = await findProductRowById(productId, storeId);

  if (!existingProduct) {
    throw new ApiError(404, 'Product not found.');
  }

  if (existingProduct.parent_product_id) {
    throw new ApiError(400, 'Update a product size through the size endpoint.');
  }

  const nextName =
    payload.name === undefined ? existingProduct.name : normalizeString(payload.name);
  const nextCategoryId =
    payload.categoryId === undefined && payload.category_id === undefined
      ? existingProduct.category_id
      : normalizeCategoryId(payload.categoryId ?? payload.category_id);
  const nextImageUrl =
    payload.imageUrl === undefined && payload.image_url === undefined
      ? existingProduct.image_url
      : normalizeImageUrl(payload.imageUrl ?? payload.image_url);
  const nextUnit =
    payload.unit === undefined ? normalizeUnit(existingProduct.unit) : normalizeUnit(payload.unit);
  const nextPrice =
    payload.price === undefined ? Number(existingProduct.price) : ensureValidPrice(payload.price);
  const nextStatus =
    payload.status === undefined ? existingProduct.status : normalizeStatus(payload.status);
  const hasRecipeItems = Object.hasOwn(payload, 'recipeItems');
  const recipeItems = hasRecipeItems ? normalizeRecipeItems(payload.recipeItems) : null;

  if (existingProduct.is_group && hasRecipeItems) {
    throw new ApiError(400, 'A size group cannot manage a sellable recipe. Update a size recipe instead.');
  }

  ensureValidName(nextName);
  ensureValidStatus(nextStatus);
  ensureValidImageUrl(nextImageUrl);
  ensureValidUnit(nextUnit);

  await ensureUniqueProductName(nextName, storeId, existingProduct.id);

  const client = await pool.connect();
  try {
    await client.query('begin');
    const lockedProduct = await getProductForUpdate(client, productId, storeId);
    if (!lockedProduct || lockedProduct.parent_product_id) {
      throw new ApiError(404, 'Product not found.');
    }
    if (Boolean(lockedProduct.is_group) !== Boolean(existingProduct.is_group)) {
      throw new ApiError(409, 'Product size configuration changed. Reload the product and try again.');
    }
    await ensureCategoryIsUsable(client, nextCategoryId, storeId, CATEGORY_SCOPES.PRODUCT);
    if (!existingProduct.is_group && nextStatus === PRODUCT_STATUS.ACTIVE) {
      await ensureCatalogInventoryProvisioned(client, { storeId, catalogId: productId, itemType: 'PRODUCT', unit: nextUnit });
    }
    if (!existingProduct.is_group && nextUnit !== existingProduct.unit) {
      const inventory = await client.query('select id from inventory_items where product_id=$1 and store_id=$2', [productId, storeId]);
      if (inventory.rows[0]) await synchronizeSafeBaseUnit(client, { storeId, inventoryItemId: inventory.rows[0].id, nextUnit });
    }
    if (existingProduct.is_group && nextUnit !== existingProduct.unit) {
      const variants = await client.query(`select p.id,ii.id as inventory_item_id from products p left join inventory_items ii on ii.product_id=p.id and ii.store_id=p.store_id where p.parent_product_id=$1 and p.store_id=$2 and p.deleted_at is null`, [productId, storeId]);
      for (const variant of variants.rows) {
        if (variant.inventory_item_id) await synchronizeSafeBaseUnit(client, { storeId, inventoryItemId: variant.inventory_item_id, nextUnit });
      }
    }
    if (existingProduct.is_group && nextStatus === PRODUCT_STATUS.ACTIVE) {
      const variants = await client.query('select id,unit from products where parent_product_id=$1 and store_id=$2 and deleted_at is null', [productId, storeId]);
      for (const variant of variants.rows) await ensureCatalogInventoryProvisioned(client, { storeId, catalogId: variant.id, itemType: 'PRODUCT', unit: variant.unit });
    }
    if (existingProduct.is_group) {
      await ensureDerivedVariantNamesAreUnique(client, productId, nextName, storeId);
    }
    await client.query(
      `update products
       set name = $1,
           category_id = $2,
           image_url = $3,
           price = $4,
           unit = $5,
           status = $6,
           updated_at = now()
       where id = $7
         and store_id = $8
         and deleted_at is null`,
      [nextName, nextCategoryId, nextImageUrl, nextPrice, nextUnit, nextStatus, productId, storeId],
    );

    if (existingProduct.is_group) {
      await client.query(
        `update products
         set name = $1 || ' - ' || size_name,
             category_id = $2,
             image_url = $3,
             unit = $4,
             status = $5,
             updated_at = now()
         where parent_product_id = $6
           and store_id = $7
           and deleted_at is null`,
        [nextName, nextCategoryId, nextImageUrl, nextUnit, nextStatus, productId, storeId],
      );
    } else if (recipeItems) {
      await replaceProductRecipe(client, productId, actorUser.id, storeId, recipeItems);
    }

    await client.query('commit');
    return getProductById(productId, storeId);
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function softDeleteProduct(productId, storeId) {
  const existingProduct = await getProductById(productId, storeId);

  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(
      `update products
       set deleted_at = now(),
           updated_at = now()
       where id = $1
         and store_id = $2
         and deleted_at is null`,
      [productId, storeId],
    );

    if (existingProduct.isGroup) {
      await client.query(
        `update products
         set deleted_at = now(),
             updated_at = now()
         where parent_product_id = $1
           and store_id = $2
           and deleted_at is null`,
        [productId, storeId],
      );
    }

    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }

  return existingProduct;
}

function ensureValidSizeName(sizeName) {
  if (!sizeName) {
    throw new ApiError(400, 'Size name is required.');
  }
  if (sizeName.length > 63) {
    throw new ApiError(400, 'Size name must not exceed 63 characters.');
  }
}

async function getProductForUpdate(client, productId, storeId) {
  const result = await client.query(
    `select id, name, category_id, image_url, price, unit, status,
            is_group, parent_product_id, size_name, sort_order
     from products
     where id = $1
       and store_id = $2
       and deleted_at is null
     limit 1
     for update`,
    [productId, storeId],
  );
  return result.rows[0] || null;
}

async function ensureUniqueVariantSizeName(client, parentProductId, sizeName, storeId, excludeProductId = null) {
  const params = [parentProductId, sizeName, storeId];
  const conditions = [
    'parent_product_id = $1',
    'lower(btrim(size_name)) = lower(btrim($2))',
    'store_id = $3',
    'deleted_at is null',
  ];
  if (excludeProductId) {
    params.push(excludeProductId);
    conditions.push(`id <> $${params.length}`);
  }

  const result = await client.query(
    `select id from products where ${conditions.join(' and ')} limit 1`,
    params,
  );
  if (result.rows[0]) {
    throw new ApiError(409, 'A size with this name already exists for the product.');
  }
}

async function ensureUniqueVariantSortOrder(client, parentProductId, sortOrder, storeId) {
  const result = await client.query(
    `select id from products
     where parent_product_id = $1
       and sort_order = $2
       and store_id = $3
       and deleted_at is null
     limit 1`,
    [parentProductId, sortOrder, storeId],
  );
  if (result.rows[0]) {
    throw new ApiError(409, 'A size already uses this sort order. Reorder sizes instead.');
  }
}

async function ensureDerivedVariantNamesAreUnique(client, parentProductId, parentName, storeId) {
  const variants = await client.query(
    `select id, size_name
     from products
     where parent_product_id = $1 and store_id = $2 and deleted_at is null
     for update`,
    [parentProductId, storeId],
  );
  for (const variant of variants.rows) {
    await ensureUniqueProductName(
      deriveVariantName(parentName, variant.size_name),
      storeId,
      variant.id,
      client,
    );
  }
}

async function loadRecipeItemsForCopy(client, productId, storeId) {
  const result = await client.query(
    `select ri.ingredient_id, ri.quantity_required
     from recipes r
     join recipe_items ri on ri.recipe_id = r.id
     where r.product_id = $1
       and r.store_id = $2
       and r.deleted_at is null
     order by ri.id asc`,
    [productId, storeId],
  );
  return result.rows.map((row) => ({
    ingredientId: row.ingredient_id,
    quantity: Number(row.quantity_required),
  }));
}

async function getNextVariantSortOrder(client, parentProductId, storeId) {
  const result = await client.query(
    `select coalesce(max(sort_order), -1) + 1 as next_sort_order
     from products
     where parent_product_id = $1
       and store_id = $2
       and deleted_at is null`,
    [parentProductId, storeId],
  );
  return Number(result.rows[0].next_sort_order);
}

export async function addProductSize(parentProductId, payload, actorUser, storeId) {
  const normalizedParentId = normalizeId(parentProductId, 'Parent product id');
  const sizeName = normalizeString(payload.sizeName ?? payload.size_name);
  const price = ensureValidPrice(payload.price);
  const hasRecipeItems = Object.hasOwn(payload, 'recipeItems');
  const recipeItems = hasRecipeItems ? normalizeRecipeItems(payload.recipeItems) : null;
  const requestedSortOrder = payload.sortOrder === undefined && payload.sort_order === undefined
    ? null
    : normalizeSortOrder(payload.sortOrder ?? payload.sort_order);

  ensureValidSizeName(sizeName);

  const client = await pool.connect();
  try {
    await client.query('begin');
    const parent = await getProductForUpdate(client, normalizedParentId, storeId);
    if (!parent) throw new ApiError(404, 'Parent product not found.');
    if (parent.parent_product_id) throw new ApiError(400, 'A product size cannot own other sizes.');

    await ensureUniqueVariantSizeName(client, parent.id, sizeName, storeId);
    const sortOrder = requestedSortOrder ?? await getNextVariantSortOrder(client, parent.id, storeId);
    await ensureUniqueVariantSortOrder(client, parent.id, sortOrder, storeId);
    const copiedRecipeItems = recipeItems ?? await loadRecipeItemsForCopy(client, parent.id, storeId);
    const childName = deriveVariantName(parent.name, sizeName);
    await ensureUniqueProductName(childName, storeId, null, client);

    if (!parent.is_group) {
      await client.query(
        `update products set is_group = true, updated_at = now()
         where id = $1 and store_id = $2`,
        [parent.id, storeId],
      );
    }

    const inserted = await client.query(
      `insert into products (
         name, category_id, image_url, price, unit, status, is_group,
         parent_product_id, size_name, sort_order, created_by, store_id
       ) values ($1, $2, $3, $4, $5, $6, false, $7, $8, $9, $10, $11)
       returning id`,
      [
        childName,
        parent.category_id,
        parent.image_url,
        price,
        parent.unit,
        parent.status,
        parent.id,
        sizeName,
        sortOrder,
        actorUser.id,
        storeId,
      ],
    );
    await provisionCatalogInventoryItem(client, { storeId, catalogId: inserted.rows[0].id, itemType: 'PRODUCT', unit: parent.unit });
    await replaceProductRecipe(client, inserted.rows[0].id, actorUser.id, storeId, copiedRecipeItems);

    await client.query('commit');
    return getProductById(parent.id, storeId);
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateProductSize(parentProductId, sizeProductId, payload, actorUser, storeId) {
  const normalizedParentId = normalizeId(parentProductId, 'Parent product id');
  const normalizedSizeId = normalizeId(sizeProductId, 'Size product id');
  if (payload.status !== undefined) {
    throw new ApiError(400, 'A size status is controlled by its parent product.');
  }

  const client = await pool.connect();
  try {
    await client.query('begin');
    const parent = await getProductForUpdate(client, normalizedParentId, storeId);
    if (!parent || !parent.is_group || parent.parent_product_id) {
      throw new ApiError(404, 'Size group not found.');
    }
    const size = await getProductForUpdate(client, normalizedSizeId, storeId);
    if (!size || size.parent_product_id !== parent.id) {
      throw new ApiError(404, 'Product size not found.');
    }

    const sizeName = payload.sizeName === undefined && payload.size_name === undefined
      ? size.size_name
      : normalizeString(payload.sizeName ?? payload.size_name);
    const price = payload.price === undefined ? Number(size.price) : ensureValidPrice(payload.price);
    const hasRecipeItems = Object.hasOwn(payload, 'recipeItems');
    const recipeItems = hasRecipeItems ? normalizeRecipeItems(payload.recipeItems) : null;
    ensureValidSizeName(sizeName);
    await ensureUniqueVariantSizeName(client, parent.id, sizeName, storeId, size.id);

    const childName = deriveVariantName(parent.name, sizeName);
    await ensureUniqueProductName(childName, storeId, size.id, client);
    await client.query(
      `update products
       set name = $1,
           price = $2,
           category_id = $3,
           image_url = $4,
           unit = $5,
           status = $6,
           size_name = $7,
           updated_at = now()
       where id = $8 and store_id = $9`,
      [childName, price, parent.category_id, parent.image_url, parent.unit, parent.status, sizeName, size.id, storeId],
    );
    if (recipeItems) {
      await replaceProductRecipe(client, size.id, actorUser.id, storeId, recipeItems);
    }

    await client.query('commit');
    return getProductById(parent.id, storeId);
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function reorderProductSizes(parentProductId, payload, storeId) {
  const normalizedParentId = normalizeId(parentProductId, 'Parent product id');
  const providedIds = payload.sizeIds ?? payload.size_ids ?? payload.variantIds ?? payload.variant_ids;
  if (!Array.isArray(providedIds) || providedIds.length === 0) {
    throw new ApiError(400, 'Size ids must be a non-empty array.');
  }
  const sizeIds = providedIds.map((id, index) => normalizeId(id, `Size id at row ${index + 1}`));
  if (new Set(sizeIds).size !== sizeIds.length) {
    throw new ApiError(400, 'Each size may appear only once when reordering.');
  }

  const client = await pool.connect();
  try {
    await client.query('begin');
    const parent = await getProductForUpdate(client, normalizedParentId, storeId);
    if (!parent || !parent.is_group || parent.parent_product_id) {
      throw new ApiError(404, 'Size group not found.');
    }
    const currentSizes = await client.query(
      `select id, sort_order from products
       where parent_product_id = $1 and store_id = $2 and deleted_at is null
       order by sort_order asc nulls last, created_at asc
       for update`,
      [parent.id, storeId],
    );
    const currentIds = currentSizes.rows.map((row) => String(row.id));
    if (currentIds.length !== sizeIds.length || currentIds.some((id) => !sizeIds.includes(id))) {
      throw new ApiError(400, 'Reorder must contain every active size exactly once.');
    }

    const maxSortOrder = Math.max(-1, ...currentSizes.rows.map((row) => Number(row.sort_order ?? -1)));
    await client.query(
      `update products
       set sort_order = sort_order + $1, updated_at = now()
       where parent_product_id = $2 and store_id = $3 and deleted_at is null`,
      [maxSortOrder + currentIds.length + 1, parent.id, storeId],
    );
    for (let index = 0; index < sizeIds.length; index += 1) {
      await client.query(
        `update products set sort_order = $1, updated_at = now()
         where id = $2 and parent_product_id = $3 and store_id = $4`,
        [index, sizeIds[index], parent.id, storeId],
      );
    }

    await client.query('commit');
    return getProductById(parent.id, storeId);
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function archiveProductSize(parentProductId, sizeProductId, storeId) {
  const normalizedParentId = normalizeId(parentProductId, 'Parent product id');
  const normalizedSizeId = normalizeId(sizeProductId, 'Size product id');
  const client = await pool.connect();
  try {
    await client.query('begin');
    const parent = await getProductForUpdate(client, normalizedParentId, storeId);
    if (!parent || !parent.is_group || parent.parent_product_id) {
      throw new ApiError(404, 'Size group not found.');
    }
    const size = await getProductForUpdate(client, normalizedSizeId, storeId);
    if (!size || size.parent_product_id !== parent.id) {
      throw new ApiError(404, 'Product size not found.');
    }
    await client.query(
      `update products set deleted_at = now(), updated_at = now()
       where id = $1 and parent_product_id = $2 and store_id = $3`,
      [size.id, parent.id, storeId],
    );
    await client.query('commit');
    return getProductById(parent.id, storeId);
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function listPosAvailableProducts(storeId) {
  const result = await query(
    `select p.id,
            case
              when p.parent_product_id is not null then parent.name || ' - ' || p.size_name
              else p.name
            end as name,
            coalesce(parent.category_id, p.category_id) as category_id,
            c.name as category_name,
            c.scope as category_scope,
            coalesce(parent.image_url, p.image_url) as image_url,
            p.price,
            coalesce(parent.unit, p.unit) as unit,
            coalesce(parent.status, p.status) as status,
            p.is_group,
            p.parent_product_id,
            p.size_name,
            p.sort_order,
            p.created_at,
            p.updated_at,
            inventory.product_inventory_mode,
            inventory.quantity_on_hand as inventory_quantity_on_hand,
            inventory.low_stock_threshold as inventory_low_stock_threshold,
            exists(
              select 1
              from recipes r
              join recipe_items ri on ri.recipe_id = r.id
              where r.product_id = p.id
                and r.store_id = p.store_id
                and r.deleted_at is null
            ) as has_recipe
     from products p
     left join products parent
       on parent.id = p.parent_product_id
      and parent.store_id = p.store_id
      and parent.deleted_at is null
     left join categories c
       on c.id = coalesce(parent.category_id, p.category_id)
      and c.store_id = p.store_id
      and c.deleted_at is null
     left join inventory_items inventory on inventory.product_id=p.id and inventory.store_id=p.store_id
     where p.store_id = $1
       and p.deleted_at is null
       and (
         (p.parent_product_id is null and coalesce(p.is_group, false) = false and p.status = $2)
         or (p.parent_product_id is not null and parent.id is not null and parent.status = $2)
       )
     order by coalesce(parent.name, p.name) asc,
              case when p.parent_product_id is null then 0 else 1 end,
              p.sort_order asc nulls last,
              p.created_at asc`,
    [storeId, PRODUCT_STATUS.ACTIVE],
  );

  return result.rows.map((row) => toPublicProduct({ ...row,
    inventory_can_sell: row.product_inventory_mode === 'STOCKED' ? Number(row.inventory_quantity_on_hand || 0) > 0 : null,
    inventory_is_low_stock: row.product_inventory_mode === 'STOCKED' && row.inventory_low_stock_threshold !== null ? Number(row.inventory_quantity_on_hand || 0) <= Number(row.inventory_low_stock_threshold) : null,
  }));
}

export async function createBulkProducts(payloadArray, actorUser, storeId) {
  if (!Array.isArray(payloadArray) || payloadArray.length === 0) {
    throw new ApiError(400, 'Payload must be a non-empty array.');
  }

  const client = await pool.connect();
  const createdProductIds = [];
  try {
    await client.query('begin');

    for (const item of payloadArray) {
      const name = normalizeString(item.name);
      const categoryId = normalizeCategoryId(item.categoryId ?? item.category_id);
      const imageUrl = normalizeImageUrl(item.imageUrl ?? item.image_url);
      const unit = normalizeUnit(item.unit);
      const status = normalizeStatus(item.status || PRODUCT_STATUS.ACTIVE);
      
      ensureValidName(name);
      ensureValidStatus(status);
      ensureValidImageUrl(imageUrl);
      ensureValidUnit(unit);
      
      if (categoryId) {
        await ensureCategoryIsUsable(client, categoryId, storeId, CATEGORY_SCOPES.PRODUCT);
      }

      if (item.sizes && Array.isArray(item.sizes) && item.sizes.length > 0) {
        const parentPrice = ensureValidPrice(item.price);
        await ensureUniqueProductName(name, storeId, null, client);
        const parentResult = await client.query(
          `insert into products (name, category_id, image_url, price, unit, status, is_group, created_by, store_id)
           values ($1, $2, $3, $4, $5, $6, true, $7, $8)
           returning id`,
          [name, categoryId, imageUrl, parentPrice, unit, status, actorUser.id, storeId]
        );
        const parentId = parentResult.rows[0].id;
        
        for (const [index, size] of item.sizes.entries()) {
          const sizeName = normalizeString(size.sizeName ?? size.size_name);
          const childName = deriveVariantName(name, sizeName);
          const childPrice = ensureValidPrice(size.price);
          const recipeItems = normalizeRecipeItems(size.recipeItems || []);
          
          ensureValidSizeName(sizeName);
          await ensureUniqueVariantSizeName(client, parentId, sizeName, storeId);
          await ensureUniqueProductName(childName, storeId, null, client);
          
          const childResult = await client.query(
            `insert into products (name, category_id, image_url, price, unit, status, is_group, parent_product_id, size_name, sort_order, created_by, store_id)
             values ($1, $2, $3, $4, $5, $6, false, $7, $8, $9, $10, $11)
             returning id`,
            [childName, categoryId, imageUrl, childPrice, unit, status, parentId, sizeName, index, actorUser.id, storeId]
          );
          await provisionCatalogInventoryItem(client, { storeId, catalogId: childResult.rows[0].id, itemType: 'PRODUCT', unit });
          
          await replaceProductRecipe(client, childResult.rows[0].id, actorUser.id, storeId, recipeItems);
        }
        
        createdProductIds.push(parentId);
      } else {
        const price = ensureValidPrice(item.price);
        const recipeItems = normalizeRecipeItems(item.recipeItems || []);
        await ensureUniqueProductName(name, storeId, null, client);

        const result = await client.query(
          `insert into products (name, category_id, image_url, price, unit, status, created_by, store_id)
           values ($1, $2, $3, $4, $5, $6, $7, $8)
           returning id`,
          [name, categoryId, imageUrl, price, unit, status, actorUser.id, storeId]
        );

        await provisionCatalogInventoryItem(client, { storeId, catalogId: result.rows[0].id, itemType: 'PRODUCT', unit });

        await replaceProductRecipe(client, result.rows[0].id, actorUser.id, storeId, recipeItems);
        createdProductIds.push(result.rows[0].id);
      }
    }

    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }

  return Promise.all(createdProductIds.map((productId) => getProductById(productId, storeId)));
}
