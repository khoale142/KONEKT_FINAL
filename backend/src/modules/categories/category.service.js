import { query } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';

export const CATEGORY_SCOPES = Object.freeze({
  PRODUCT: 'PRODUCT',
  INGREDIENT: 'INGREDIENT',
  PREPARATION: 'PREPARATION',
});

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeScope(value) {
  return normalizeString(value).toUpperCase();
}

function ensureValidName(name) {
  if (!name) throw new ApiError(400, 'Category name is required.');
  if (name.length > 80) throw new ApiError(400, 'Category name must not exceed 80 characters.');
}

function ensureValidScope(scope) {
  if (!Object.values(CATEGORY_SCOPES).includes(scope)) {
    throw new ApiError(400, 'Category scope is invalid.');
  }
}

function toPublicCategory(row) {
  return {
    id: row.id,
    name: row.name,
    scope: row.scope,
    productCount: Number(row.product_count || 0),
    ingredientCount: Number(row.ingredient_count || 0),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function categorySelect(whereClause) {
  return `select c.id, c.name, c.scope, c.created_at, c.updated_at,
                 (select count(*) from products p where p.category_id = c.id and p.store_id = c.store_id and p.deleted_at is null) as product_count,
                 (select count(*) from ingredients i where i.category_id = c.id and i.store_id = c.store_id and i.deleted_at is null) as ingredient_count
          from categories c
          where ${whereClause}`;
}

export async function listCategories({ scope } = {}, storeId) {
  const normalizedScope = normalizeScope(scope);
  const params = [storeId];
  const conditions = ['c.store_id = $1', 'c.deleted_at is null'];

  if (normalizedScope) {
    ensureValidScope(normalizedScope);
    params.push(normalizedScope);
    conditions.push(`c.scope = $${params.length}`);
  }

  const result = await query(
    `${categorySelect(conditions.join(' and '))} order by lower(c.name) asc`,
    params,
  );
  return result.rows.map(toPublicCategory);
}

export async function createCategory(payload, actorUser, storeId) {
  const name = normalizeString(payload.name);
  const scope = normalizeScope(payload.scope);
  ensureValidName(name);
  ensureValidScope(scope);

  try {
    const result = await query(
      `insert into categories (store_id, name, scope, created_by)
       values ($1, $2, $3, $4)
       returning id`,
      [storeId, name, scope, actorUser.id],
    );
    return getCategoryById(result.rows[0].id, storeId);
  } catch (error) {
    if (error.code === '23505') throw new ApiError(409, 'A category with this name already exists.');
    throw error;
  }
}

export async function getCategoryById(categoryId, storeId) {
  const result = await query(
    `${categorySelect('c.id = $1 and c.store_id = $2 and c.deleted_at is null')} limit 1`,
    [categoryId, storeId],
  );
  if (!result.rows[0]) throw new ApiError(404, 'Category not found.');
  return toPublicCategory(result.rows[0]);
}

export async function updateCategory(categoryId, payload, storeId) {
  const current = await getCategoryById(categoryId, storeId);
  const name = payload.name === undefined ? current.name : normalizeString(payload.name);
  const scope = payload.scope === undefined ? current.scope : normalizeScope(payload.scope);
  ensureValidName(name);
  ensureValidScope(scope);

  if (current.productCount || current.ingredientCount) {
    const hasChangedScope = scope !== current.scope;
    if (hasChangedScope) {
      throw new ApiError(400, 'Reassign items before changing a category type.');
    }
  }

  try {
    await query(
      `update categories set name = $1, scope = $2, updated_at = now()
       where id = $3 and store_id = $4 and deleted_at is null`,
      [name, scope, categoryId, storeId],
    );
  } catch (error) {
    if (error.code === '23505') throw new ApiError(409, 'A category with this name already exists.');
    throw error;
  }
  return getCategoryById(categoryId, storeId);
}

export async function deleteCategory(categoryId, storeId) {
  const category = await getCategoryById(categoryId, storeId);
  if (category.productCount || category.ingredientCount) {
    throw new ApiError(400, 'Cannot delete a category that is still used by products or ingredients.');
  }
  await query(
    `update categories set deleted_at = now(), updated_at = now()
     where id = $1 and store_id = $2 and deleted_at is null`,
    [categoryId, storeId],
  );
  return category;
}

export async function ensureCategoryIsUsable(executor, categoryId, storeId, requiredScope) {
  if (!categoryId) return null;
  const result = await executor.query(
    `select id from categories
     where id = $1 and store_id = $2 and deleted_at is null
       and scope = $3
     limit 1`,
    [categoryId, storeId, requiredScope],
  );
  if (!result.rows[0]) {
    throw new ApiError(400, 'Category is unavailable for this store or item type.');
  }
  return categoryId;
}
