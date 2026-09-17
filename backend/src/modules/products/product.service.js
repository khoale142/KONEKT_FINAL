import { query } from '../../config/db.js';
import { PRODUCT_STATUS } from '../../constants/productStatus.js';
import { ApiError } from '../../utils/ApiError.js';
import { toPublicProduct } from '../../utils/product.js';
import { DEFAULT_PRODUCT_TAG } from '../../utils/tagTaxonomy.js';

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStatus(value) {
  return normalizeString(value).toUpperCase();
}

function normalizeTag(value) {
  const normalizedValue = normalizeString(value);
  return normalizedValue || DEFAULT_PRODUCT_TAG;
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
  const normalizedPrice = Number(price);

  if (!Number.isFinite(normalizedPrice)) {
    throw new ApiError(400, 'Product price is invalid.');
  }

  if (normalizedPrice <= 0) {
    throw new ApiError(400, 'Product price must be greater than 0.');
  }

  return normalizedPrice;
}

function ensureValidTag(tag) {
  if (!tag) {
    throw new ApiError(400, 'Product tag is required.');
  }

  if (tag.length > 40) {
    throw new ApiError(400, 'Product tag must not exceed 40 characters.');
  }
}

async function findProductRowById(productId, storeId) {
  const result = await query(
    `select p.id,
            p.name,
            p.tag,
            p.price,
            p.status,
            p.created_at,
            p.updated_at,
            exists(
              select 1
              from recipes r
              where r.product_id = p.id
                and r.deleted_at is null
            ) as has_recipe
     from products p
     where p.id = $1
       and p.store_id = $2
       and p.deleted_at is null
     limit 1`,
    [productId, storeId],
  );

  return result.rows[0] || null;
}

async function ensureUniqueProductName(name, storeId, excludeProductId = null) {
  const params = [name, storeId];
  const conditions = ['lower(name) = lower($1)', 'store_id = $2', 'deleted_at is null'];

  if (excludeProductId) {
    params.push(excludeProductId);
    conditions.push(`id <> $${params.length}`);
  }

  const result = await query(
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

export async function listProductTags(storeId) {
  const result = await query(
    `select tag
     from (
       select distinct p.tag
       from products p
       where p.store_id = $1
         and p.deleted_at is null
         and p.tag is not null
         and btrim(p.tag) <> ''
     ) product_tags
     order by lower(tag) asc`,
    [storeId]
  );

  return result.rows.map((row) => row.tag).filter(Boolean);
}

export async function listProducts({ search = '', status, tag } = {}, storeId) {
  const params = [storeId];
  const conditions = ['p.store_id = $1', 'p.deleted_at is null'];
  const normalizedSearch = normalizeString(search);
  const normalizedStatus = normalizeStatus(status);
  const normalizedTag = normalizeTag(tag);

  if (normalizedSearch) {
    params.push(`%${normalizedSearch}%`);
    conditions.push(`p.name ilike $${params.length}`);
  }

  if (normalizedStatus && normalizedStatus !== 'ALL') {
    ensureValidStatus(normalizedStatus);
    params.push(normalizedStatus);
    conditions.push(`p.status = $${params.length}`);
  }

  if (normalizeString(tag) && normalizedTag !== 'ALL') {
    ensureValidTag(normalizedTag);
    params.push(normalizedTag);
    conditions.push(`lower(p.tag) = lower($${params.length})`);
  }

  const result = await query(
    `select p.id,
            p.name,
            p.tag,
            p.price,
            p.status,
            p.created_at,
            p.updated_at,
            exists(
              select 1
              from recipes r
              where r.product_id = p.id
                and r.deleted_at is null
            ) as has_recipe
     from products p
     where ${conditions.join(' and ')}
     order by p.created_at desc, p.name asc`,
    params,
  );

  return result.rows.map(toPublicProduct);
}

export async function getProductById(productId, storeId) {
  const product = await findProductRowById(productId, storeId);

  if (!product) {
    throw new ApiError(404, 'Product not found.');
  }

  return toPublicProduct(product);
}

export async function createProduct(payload, actorUser, storeId) {
  const name = normalizeString(payload.name);
  const tag = normalizeTag(payload.tag);
  const price = ensureValidPrice(payload.price);
  const status = normalizeStatus(payload.status || PRODUCT_STATUS.ACTIVE);

  ensureValidName(name);
  ensureValidTag(tag);
  ensureValidStatus(status);

  await ensureUniqueProductName(name, storeId);

  const result = await query(
    `insert into products (name, tag, price, status, created_by, store_id)
     values ($1, $2, $3, $4, $5, $6)
     returning id`,
    [name, tag, price, status, actorUser.id, storeId],
  );

  return getProductById(result.rows[0].id, storeId);
}

export async function updateProduct(productId, payload, storeId) {
  const existingProduct = await findProductRowById(productId, storeId);

  if (!existingProduct) {
    throw new ApiError(404, 'Product not found.');
  }

  const nextName =
    payload.name === undefined ? existingProduct.name : normalizeString(payload.name);
  const nextTag =
    payload.tag === undefined ? normalizeTag(existingProduct.tag) : normalizeTag(payload.tag);
  const nextPrice =
    payload.price === undefined ? Number(existingProduct.price) : ensureValidPrice(payload.price);
  const nextStatus =
    payload.status === undefined ? existingProduct.status : normalizeStatus(payload.status);

  ensureValidName(nextName);
  ensureValidTag(nextTag);
  ensureValidStatus(nextStatus);

  await ensureUniqueProductName(nextName, storeId, existingProduct.id);

  await query(
    `update products
     set name = $1,
         tag = $2,
         price = $3,
         status = $4,
         updated_at = now()
     where id = $5
       and store_id = $6
       and deleted_at is null`,
    [nextName, nextTag, nextPrice, nextStatus, productId, storeId],
  );

  return getProductById(productId, storeId);
}

export async function softDeleteProduct(productId, storeId) {
  const existingProduct = await getProductById(productId, storeId);

  await query(
    `update products
     set deleted_at = now(),
         updated_at = now()
     where id = $1
       and store_id = $2
       and deleted_at is null`,
    [productId, storeId],
  );

  return existingProduct;
}

export async function listPosAvailableProducts(storeId) {
  const result = await query(
    `select p.id,
            p.name,
            p.tag,
            p.price,
            p.status,
            p.created_at,
            p.updated_at,
            true as has_recipe
     from products p
     where p.store_id = $1
       and p.deleted_at is null
       and p.status = $2
       and exists(
         select 1
         from recipes r
         join recipe_items ri on ri.recipe_id = r.id
         where r.product_id = p.id
           and r.deleted_at is null
       )
     order by p.name asc`,
    [storeId, PRODUCT_STATUS.ACTIVE],
  );

  return result.rows.map(toPublicProduct);
}
