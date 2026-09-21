import { ApiError } from '../../utils/ApiError.js';

// Phase 5 is deliberately one-way: inventory_items is authoritative and this mirrors the exact
// resulting quantity only for the matching legacy Ingredient row in the same transaction.
export async function mirrorIngredientQuantityFromInventory(client, { storeId, inventoryItem, resultingQuantity }) {
  if (!inventoryItem.ingredient_id || !['RAW_INGREDIENT', 'PREPARATION'].includes(inventoryItem.item_type)) return null;
  const result = await client.query(`
    update ingredients set current_stock=$1::numeric,updated_at=now()
    where id=$2 and store_id=$3 and deleted_at is null
    returning id,current_stock`, [resultingQuantity, inventoryItem.ingredient_id, storeId]);
  if (!result.rows[0]) throw new ApiError(409, 'Inventory compatibility mirror target is unavailable.');
  return result.rows[0];
}
