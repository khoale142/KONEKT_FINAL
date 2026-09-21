import { query } from '../../config/db.js';

export async function findMovementsByPostingKeys(executor, postingKeys) {
  if (!postingKeys.length) return [];
  const result = await executor.query(`
    select id, store_id, inventory_item_id, posting_key, movement_type,
           quantity_delta, before_quantity, after_quantity,
           unit_cost_snapshot, value_delta, occurred_at
    from inventory_movements
    where posting_key = any($1::text[])
    order by posting_key`, [postingKeys]);
  return result.rows;
}

export async function lockInventoryItems(executor, storeId, inventoryItemIds) {
  const sortedUniqueIds = [...new Set(inventoryItemIds)].sort();
  const result = await executor.query(`
    select ii.id,
           ii.store_id,
           ii.item_type,
           ii.ingredient_id,
           ii.product_id,
           ii.quantity_on_hand,
           ii.inventory_value,
           ii.current_unit_cost,
           ii.cost_status,
           ii.cost_version,
           ii.row_version,
           ii.product_inventory_mode,
           ingredient.deleted_at as ingredient_deleted_at,
           ingredient.is_preparation as ingredient_is_preparation,
           product.is_group as product_is_group,
           product.parent_product_id as product_parent_product_id,
           product.deleted_at as product_deleted_at,
           product.status as product_status
    from inventory_items ii
    left join ingredients ingredient
      on ingredient.id = ii.ingredient_id and ingredient.store_id = ii.store_id
    left join products product
      on product.id = ii.product_id and product.store_id = ii.store_id
    where ii.store_id = $1
      and ii.id = any($2::uuid[])
    order by ii.id
    for update of ii
  `, [storeId, sortedUniqueIds]);
  return result.rows;
}

export async function listInventoryMovements(input = {}, storeId) {
  const params = [storeId];
  const conditions = ['movement.store_id = $1'];
  const normalized = (value) => (typeof value === 'string' ? value.trim() : '');
  const movementType = normalized(input.movementType ?? input.movement_type).toUpperCase();
  const inventoryItemId = normalized(input.inventoryItemId ?? input.inventory_item_id);
  const orderId = normalized(input.orderId ?? input.order_id);
  const search = normalized(input.search);
  const occurredFrom = normalized(input.occurredFrom ?? input.occurred_from ?? input.dateFrom ?? input.date_from);
  const occurredTo = normalized(input.occurredTo ?? input.occurred_to ?? input.dateTo ?? input.date_to);

  if (movementType) {
    params.push(movementType);
    conditions.push(`movement.movement_type = $${params.length}`);
  }
  if (inventoryItemId) {
    params.push(inventoryItemId);
    conditions.push(`movement.inventory_item_id = $${params.length}`);
  }
  if (orderId) {
    params.push(orderId);
    conditions.push(`movement.order_id = $${params.length}`);
  }
  if (occurredFrom) {
    params.push(occurredFrom);
    conditions.push(`movement.occurred_at >= $${params.length}::timestamptz`);
  }
  if (occurredTo) {
    params.push(occurredTo);
    conditions.push(`movement.occurred_at <= $${params.length}::timestamptz`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`coalesce(ingredient.name, product.name) ilike $${params.length}`);
  }

  const parsedLimit = Number(input.limit ?? 50);
  const parsedOffset = Number(input.offset ?? 0);
  const limit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 200) : 50;
  const offset = Number.isInteger(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;
  params.push(limit, offset);

  const result = await query(`
    select movement.id,
           movement.inventory_item_id,
           movement.movement_type,
           movement.quantity_delta,
           movement.before_quantity,
           movement.after_quantity,
           movement.unit_cost_snapshot,
           movement.value_delta,
           movement.occurred_at,
           movement.created_at,
           coalesce(ingredient.name, product.name) as item_name,
           item.item_type,
           base_unit.name as unit_name,
           base_unit.symbol as unit_symbol,
           coalesce(nullif(actor.full_name, ''), actor.username) as actor_name
    from inventory_movements movement
    join inventory_items item on item.id = movement.inventory_item_id and item.store_id = movement.store_id
    left join ingredients ingredient on ingredient.id = item.ingredient_id and ingredient.store_id = item.store_id
    left join products product on product.id = item.product_id and product.store_id = item.store_id
    left join inventory_item_units base_unit on base_unit.inventory_item_id = item.id and base_unit.is_base
    left join app_users actor on actor.id = movement.posted_by
    where ${conditions.join(' and ')}
    order by movement.occurred_at desc, movement.id desc
    limit $${params.length - 1} offset $${params.length}
  `, params);
  return result.rows;
}

export async function getInventoryMovementById(movementId, storeId) {
  const result = await query(`
    select movement.id,
           movement.inventory_item_id,
           movement.movement_type,
           movement.quantity_delta,
           movement.before_quantity,
           movement.after_quantity,
           movement.unit_cost_snapshot,
           movement.value_delta,
           movement.occurred_at,
           movement.created_at,
           coalesce(ingredient.name, product.name) as item_name,
           item.item_type,
           base_unit.name as unit_name,
           base_unit.symbol as unit_symbol,
           coalesce(nullif(actor.full_name, ''), actor.username) as actor_name
    from inventory_movements movement
    join inventory_items item on item.id = movement.inventory_item_id and item.store_id = movement.store_id
    left join ingredients ingredient on ingredient.id = item.ingredient_id and ingredient.store_id = item.store_id
    left join products product on product.id = item.product_id and product.store_id = item.store_id
    left join inventory_item_units base_unit on base_unit.inventory_item_id = item.id and base_unit.is_base
    left join app_users actor on actor.id = movement.posted_by
    where movement.id = $1 and movement.store_id = $2
    limit 1
  `, [movementId, storeId]);
  return result.rows[0] || null;
}
