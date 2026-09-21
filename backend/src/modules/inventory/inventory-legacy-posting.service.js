import { ApiError } from '../../utils/ApiError.js';
import { multiplyDecimal } from './inventory-decimal.js';
import { postInventoryMovements } from './inventory-posting.service.js';

export async function findIngredientInventoryItems(client, storeId, ingredientIds) {
  const result = await client.query(`
    select id,ingredient_id,item_type,quantity_on_hand,inventory_value,current_unit_cost,cost_status
    from inventory_items where store_id=$1 and ingredient_id=any($2::uuid[])
      and item_type in ('RAW_INGREDIENT','PREPARATION')`, [storeId, ingredientIds]);
  const byIngredient = new Map(result.rows.map((row) => [String(row.ingredient_id), row]));
  if (byIngredient.size !== new Set(ingredientIds.map(String)).size) {
    throw new ApiError(409, 'An Ingredient is missing its authoritative inventory item.');
  }
  return byIngredient;
}

function valueMutation(item, quantityDelta) {
  if (item.cost_status !== 'AVAILABLE' || item.current_unit_cost === null || item.inventory_value === null) return null;
  const valueDelta = multiplyDecimal(String(item.current_unit_cost), String(quantityDelta));
  return { valueDelta, balanceMutation: { inventoryValueDelta: valueDelta } };
}

// Bridge existing operations to the unified ledger. The posting service owns quantity mutation
// and the one-way legacy mirror; this helper only appends legacy audit rows after non-idempotent posting.
export async function postLegacyIngredientChanges(client, { storeId, actorId, operationKey, changes, allowNegative = false }) {
  const ingredientIds = changes.map((change) => change.ingredientId);
  const itemsByIngredient = await findIngredientInventoryItems(client, storeId, ingredientIds);
  const movements = changes.map((change) => {
    const item = itemsByIngredient.get(String(change.ingredientId));
    const valuation = change.valueDelta !== undefined
      ? { valueDelta: String(change.valueDelta), balanceMutation: { inventoryValueDelta: String(change.valueDelta) } }
      : valueMutation(item, change.quantityDelta);
    return {
      inventoryItemId: item.id, postingKey: `${operationKey}:${change.movementType}:${item.id}`, movementType: change.movementType,
      quantityDelta: String(change.quantityDelta), unitCostSnapshot: change.unitCostSnapshot ?? (item.cost_status === 'AVAILABLE' ? String(item.current_unit_cost) : null),
      valueDelta: valuation?.valueDelta ?? null, balanceMutation: valuation?.balanceMutation ?? null,
      orderId: change.orderId ?? null, orderItemId: change.orderItemId ?? null,
      metadata: { source: 'LEGACY_COMPAT', operation: change.operation, ...(change.metadata || {}) },
    };
  });
  const posted = await postInventoryMovements(client, { storeId, actorId, movements, postingGroupKey: operationKey, allowNegative });
  const byInventoryItem = new Map(posted.movements.map((movement) => [movement.inventory_item_id, movement]));
  return { ...posted, itemsByIngredient, byInventoryItem };
}
