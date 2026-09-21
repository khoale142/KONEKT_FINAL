import { query } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { multiplyDecimal, requirePositiveDecimal } from './inventory-decimal.js';
import { inventoryBaseUnitRequiredError } from './inventory-unit-conversion.service.js';

const ITEM_TYPES = new Set(['RAW_INGREDIENT', 'PREPARATION', 'PRODUCT']);

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function optionalQueryValue(value, fieldName) {
  if (value === undefined || value === null || value === '') return null;
  const normalized = normalizeString(value);
  if (!normalized) return null;
  if (normalized.length > 160) {
    throw new ApiError(400, `${fieldName} is too long.`);
  }
  return normalized;
}

function readBoolean(value, fallback = false) {
  if (value === undefined) return fallback;
  if (String(value).toLowerCase() === 'true') return true;
  if (String(value).toLowerCase() === 'false') return false;
  throw new ApiError(400, 'Boolean query value is invalid.');
}

function readPositiveInteger(value, fallback, fieldName) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new ApiError(400, `${fieldName} must be a non-negative integer.`);
  }
  return parsed;
}

function toNumber(value) {
  return value === null || value === undefined ? null : Number(value);
}

function toInventoryItemDto(row) {
  const catalogType = row.ingredient_id ? 'INGREDIENT' : 'PRODUCT';
  const catalogDeleted = Boolean(row.catalog_deleted_at);

  return {
    id: row.inventory_item_id,
    displayName: row.display_name,
    type: row.item_type,
    catalog: {
      id: row.catalog_id,
      type: catalogType,
      displayName: row.display_name,
      isDeleted: catalogDeleted,
    },
    unit: row.base_unit_name
      ? { name: row.base_unit_name, symbol: row.base_unit_symbol }
      : null,
    quantityOnHand: toNumber(row.quantity_on_hand),
    lowStockThreshold: toNumber(row.low_stock_threshold),
    currentCost: toNumber(row.current_unit_cost),
    costAvailable: row.cost_status === 'AVAILABLE' && row.current_unit_cost !== null,
    costStatus: row.cost_status,
    costMethod: row.cost_method,
    costVersion: Number(row.cost_version),
    cost: {
      method: row.cost_method,
      status: row.cost_status,
      currentUnitCost: toNumber(row.current_unit_cost),
      inventoryValue: toNumber(row.inventory_value),
      version: Number(row.cost_version),
    },
    productInventoryMode: row.product_inventory_mode,
    storageLocation: row.storage_location_id
      ? {
        id: row.storage_location_id,
        code: row.storage_location_code,
        name: row.storage_location_name,
        isActive: Boolean(row.storage_location_is_active),
      }
      : null,
    stockActivatedAt: row.stock_activated_at,
    rowVersion: Number(row.row_version),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildItemFilters(input, storeId) {
  const itemType = optionalQueryValue(input.itemType ?? input.item_type, 'Item type');
  const search = optionalQueryValue(input.search, 'Search');
  const storageLocationId = optionalQueryValue(
    input.storageLocationId ?? input.storage_location_id,
    'Storage location',
  );
  const includeDeletedCatalog = readBoolean(input.includeDeletedCatalog ?? input.include_deleted_catalog);

  if (itemType && !ITEM_TYPES.has(itemType.toUpperCase())) {
    throw new ApiError(400, 'Item type is invalid.');
  }

  const params = [storeId];
  const conditions = ['ii.store_id = $1'];
  if (itemType) {
    params.push(itemType.toUpperCase());
    conditions.push(`ii.item_type = $${params.length}`);
  }
  if (storageLocationId) {
    params.push(storageLocationId);
    conditions.push(`ii.storage_location_id = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`coalesce(ingredient.name, product.name) ilike $${params.length}`);
  }
  if (!includeDeletedCatalog) {
    conditions.push('coalesce(ingredient.deleted_at, product.deleted_at) is null');
  }

  return { params, conditions };
}

const ITEM_SELECT = `
  select ii.id as inventory_item_id,
         ii.item_type,
         ii.ingredient_id,
         ii.product_id,
         coalesce(ii.ingredient_id, ii.product_id) as catalog_id,
         coalesce(ingredient.name, product.name) as display_name,
         coalesce(ingredient.deleted_at, product.deleted_at) as catalog_deleted_at,
         ii.quantity_on_hand,
         ii.inventory_value,
         ii.current_unit_cost,
         ii.cost_method,
         ii.cost_status,
         ii.cost_version,
         ii.low_stock_threshold,
         ii.product_inventory_mode,
         ii.stock_activated_at,
         ii.row_version,
         ii.created_at,
         ii.updated_at,
         location.id as storage_location_id,
         location.code as storage_location_code,
         location.name as storage_location_name,
         location.is_active as storage_location_is_active,
         base_unit.name as base_unit_name,
         base_unit.symbol as base_unit_symbol
  from inventory_items ii
  left join ingredients ingredient
    on ingredient.id = ii.ingredient_id and ingredient.store_id = ii.store_id
  left join products product
    on product.id = ii.product_id and product.store_id = ii.store_id
  left join storage_locations location
    on location.id = ii.storage_location_id and location.store_id = ii.store_id
  left join inventory_item_units base_unit
    on base_unit.inventory_item_id = ii.id and base_unit.is_base
`;

export async function listInventoryItems(input = {}, storeId) {
  const { params, conditions } = buildItemFilters(input, storeId);
  const limit = Math.min(readPositiveInteger(input.limit, 100, 'Limit'), 200);
  const offset = readPositiveInteger(input.offset, 0, 'Offset');
  params.push(limit, offset);

  const result = await query(`
    ${ITEM_SELECT}
    where ${conditions.join(' and ')}
    order by coalesce(location.sort_order, 2147483647), location.name nulls last,
             coalesce(ingredient.name, product.name), ii.id
    limit $${params.length - 1} offset $${params.length}
  `, params);

  return result.rows.map(toInventoryItemDto);
}

export async function getInventoryItemById(inventoryItemId, storeId) {
  const normalizedId = optionalQueryValue(inventoryItemId, 'Inventory item ID');
  if (!normalizedId) throw new ApiError(400, 'Inventory item ID is required.');

  const result = await query(`
    ${ITEM_SELECT}
    where ii.id = $1 and ii.store_id = $2
    limit 1
  `, [normalizedId, storeId]);
  const item = result.rows[0];
  if (!item) throw new ApiError(404, 'Inventory item not found.');
  return toInventoryItemDto(item);
}

export async function listStorageLocations(input = {}, storeId) {
  const includeInactive = readBoolean(input.includeInactive ?? input.include_inactive);
  const params = [storeId];
  const conditions = ['store_id = $1'];
  if (!includeInactive) conditions.push('is_active');

  const result = await query(`
    select id, code, name, description, sort_order, is_active, created_at, updated_at
    from storage_locations
    where ${conditions.join(' and ')}
    order by sort_order, name, id
  `, params);

  return result.rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    sortOrder: Number(row.sort_order),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

function normalizedName(value, fieldName, maximum = 120) {
  const result = normalizeString(value);
  if (!result) throw new ApiError(400, `${fieldName} is required.`);
  if (result.length > maximum) throw new ApiError(400, `${fieldName} is too long.`);
  return result;
}

function optionalText(value, fieldName, maximum = 500) {
  if (value === undefined || value === null || value === '') return null;
  const result = normalizeString(value);
  if (result.length > maximum) throw new ApiError(400, `${fieldName} is too long.`);
  return result || null;
}

function optionalSortOrder(value) {
  if (value === undefined) return null;
  const result = Number(value);
  if (!Number.isInteger(result)) throw new ApiError(400, 'Sort order must be an integer.');
  return result;
}

function unitDto(row) {
  return {
    id: row.id, name: row.name, symbol: row.symbol, level: Number(row.level), isBase: Boolean(row.is_base),
    parentUnitId: row.parent_unit_id, multiplierToParent: toNumber(row.multiplier_to_parent),
    factorToBase: toNumber(row.factor_to_base), isActive: Boolean(row.is_active), createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

async function ensureInventoryItem(inventoryItemId, storeId) {
  const result = await query('select id from inventory_items where id=$1 and store_id=$2', [inventoryItemId, storeId]);
  if (!result.rows[0]) throw new ApiError(404, 'Inventory item not found.');
  return result.rows[0];
}

export async function listInventoryItemUnits(inventoryItemId, storeId, includeInactive = false) {
  await ensureInventoryItem(inventoryItemId, storeId);
  const result = await query(`
    select id,name,symbol,level,is_base,parent_unit_id,multiplier_to_parent,factor_to_base,is_active,created_at,updated_at
    from inventory_item_units where inventory_item_id=$1 ${includeInactive ? '' : 'and is_active'}
    order by level,id`, [inventoryItemId]);
  return result.rows.map(unitDto);
}

// Only non-base purchase levels are configurable. The catalog-derived base is intentionally
// never guessed or client-created, and the derived factor is calculated server-side.
export async function createInventoryItemUnit(inventoryItemId, payload, storeId) {
  await ensureInventoryItem(inventoryItemId, storeId);
  const base = await query('select id from inventory_item_units where inventory_item_id=$1 and is_base and is_active', [inventoryItemId]);
  if (!base.rows[0]) throw inventoryBaseUnitRequiredError();
  const parentId = normalizeString(payload.parentUnitId ?? payload.parent_unit_id);
  if (!parentId) throw new ApiError(400, 'Parent unit is required for a purchase unit.');
  const parent = await query(`select id,level,factor_to_base from inventory_item_units where id=$1 and inventory_item_id=$2 and is_active`, [parentId, inventoryItemId]);
  if (!parent.rows[0]) throw new ApiError(400, 'Parent unit must be active and belong to this inventory item.');
  if (Number(parent.rows[0].level) >= 2) throw new ApiError(400, 'A unit hierarchy may contain at most three levels including base.');
  const multiplier = requirePositiveDecimal(payload.multiplierToParent ?? payload.multiplier_to_parent, 'Multiplier to parent');
  const factor = multiplyDecimal(String(parent.rows[0].factor_to_base), multiplier);
  try {
    const inserted = await query(`
      insert into inventory_item_units(inventory_item_id,name,symbol,level,is_base,parent_unit_id,multiplier_to_parent,factor_to_base)
      values($1,$2,$3,$4,false,$5,$6::numeric,$7::numeric)
      returning id,name,symbol,level,is_base,parent_unit_id,multiplier_to_parent,factor_to_base,is_active,created_at,updated_at`, [
      inventoryItemId, normalizedName(payload.name, 'Unit name'), optionalText(payload.symbol, 'Unit symbol', 32),
      Number(parent.rows[0].level) + 1, parentId, multiplier, factor,
    ]);
    return unitDto(inserted.rows[0]);
  } catch (error) {
    if (error?.code === '23505') throw new ApiError(409, 'An active unit with this name already exists for this inventory item.');
    throw error;
  }
}

export async function updateInventoryItemUnit(inventoryItemId, unitId, payload, storeId) {
  await ensureInventoryItem(inventoryItemId, storeId);
  const existing = await query(`select * from inventory_item_units where id=$1 and inventory_item_id=$2`, [unitId, inventoryItemId]);
  const unit = existing.rows[0];
  if (!unit) throw new ApiError(404, 'Inventory unit not found.');
  if (unit.is_base && payload.isActive === false) throw new ApiError(400, 'The catalog base unit cannot be deactivated.');
  if (payload.parentUnitId !== undefined || payload.parent_unit_id !== undefined || payload.level !== undefined || payload.factorToBase !== undefined || payload.factor_to_base !== undefined || payload.isBase !== undefined || payload.is_base !== undefined) {
    throw new ApiError(400, 'Unit hierarchy and base factors are server-managed and cannot be changed through this endpoint.');
  }
  const name = payload.name === undefined ? unit.name : normalizedName(payload.name, 'Unit name');
  const symbol = payload.symbol === undefined ? unit.symbol : optionalText(payload.symbol, 'Unit symbol', 32);
  const active = payload.isActive === undefined ? unit.is_active : payload.isActive === true || payload.isActive === 'true';
  try {
    const result = await query(`update inventory_item_units set name=$1,symbol=$2,is_active=$3,updated_at=now() where id=$4
      returning id,name,symbol,level,is_base,parent_unit_id,multiplier_to_parent,factor_to_base,is_active,created_at,updated_at`, [name, symbol, active, unitId]);
    return unitDto(result.rows[0]);
  } catch (error) {
    if (error?.code === '23505') throw new ApiError(409, 'An active unit with this name already exists for this inventory item.');
    throw error;
  }
}

export async function createStorageLocation(payload, actorId, storeId) {
  try {
    const result = await query(`insert into storage_locations(store_id,code,name,description,sort_order,created_by)
      values($1,$2,$3,$4,$5,$6) returning id,code,name,description,sort_order,is_active,created_at,updated_at`, [
      storeId, optionalText(payload.code, 'Location code', 64), normalizedName(payload.name, 'Location name'),
      optionalText(payload.description, 'Location description'), optionalSortOrder(payload.sortOrder ?? payload.sort_order) ?? 0, actorId,
    ]);
    return result.rows[0];
  } catch (error) {
    if (error?.code === '23505') throw new ApiError(409, 'An active storage location with this name already exists in this Store.');
    throw error;
  }
}

export async function updateStorageLocation(locationId, payload, storeId) {
  const current = await query('select * from storage_locations where id=$1 and store_id=$2', [locationId, storeId]);
  const location = current.rows[0];
  if (!location) throw new ApiError(404, 'Storage location not found.');
  const active = payload.isActive === undefined ? location.is_active : payload.isActive === true || payload.isActive === 'true';
  try {
    const result = await query(`update storage_locations set code=$1,name=$2,description=$3,sort_order=$4,is_active=$5,updated_at=now()
      where id=$6 and store_id=$7 returning id,code,name,description,sort_order,is_active,created_at,updated_at`, [
      payload.code === undefined ? location.code : optionalText(payload.code, 'Location code', 64),
      payload.name === undefined ? location.name : normalizedName(payload.name, 'Location name'),
      payload.description === undefined ? location.description : optionalText(payload.description, 'Location description'),
      optionalSortOrder(payload.sortOrder ?? payload.sort_order) ?? Number(location.sort_order), active, locationId, storeId,
    ]);
    return result.rows[0];
  } catch (error) {
    if (error?.code === '23505') throw new ApiError(409, 'An active storage location with this name already exists in this Store.');
    throw error;
  }
}

export async function assignInventoryItemStorageLocation(inventoryItemId, storageLocationId, storeId) {
  await ensureInventoryItem(inventoryItemId, storeId);
  const locationId = storageLocationId === null || storageLocationId === '' || storageLocationId === undefined ? null : normalizeString(storageLocationId);
  if (locationId) {
    const location = await query('select id from storage_locations where id=$1 and store_id=$2', [locationId, storeId]);
    if (!location.rows[0]) throw new ApiError(400, 'Storage location must belong to this Store.');
  }
  // Deliberately excludes quantities, values, costs, row version, and movements.
  await query('update inventory_items set storage_location_id=$1,updated_at=now() where id=$2 and store_id=$3', [locationId, inventoryItemId, storeId]);
  return getInventoryItemById(inventoryItemId, storeId);
}
