import { query } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';

// These are intentionally conservative feature defaults. They centralize future inventory
// capability decisions without introducing subscription or billing behavior in this phase.
export const INVENTORY_FOUNDATION_CAPABILITIES = Object.freeze({
  recipeInventory: false,
  productInventory: false,
  production: false,
  organizationalLocations: true,
  costing: false,
});

export async function getEffectiveNegativeStockPolicy(storeId) {
  const result = await query(`
    select allow_negative_stock, negative_stock_policy_configured_at
    from stores
    where id = $1
    limit 1`, [storeId]);
  const store = result.rows[0];

  if (!store) {
    throw new ApiError(404, 'Store not found.');
  }

  // A null marker means legacy services retain their existing behavior. Deliberately return
  // no effective boolean so a future caller cannot mistake this foundation for activation.
  if (!store.negative_stock_policy_configured_at) {
    return {
      source: 'LEGACY_UNCHANGED',
      configuredAt: null,
      allowNegativeStock: null,
    };
  }

  return {
    source: 'STORE_CONFIGURATION',
    configuredAt: store.negative_stock_policy_configured_at,
    allowNegativeStock: Boolean(store.allow_negative_stock),
  };
}

export function canUseRecipeInventory() {
  return INVENTORY_FOUNDATION_CAPABILITIES.recipeInventory;
}

export function canUseProductInventory() {
  return INVENTORY_FOUNDATION_CAPABILITIES.productInventory;
}

export function canUseProduction() {
  return INVENTORY_FOUNDATION_CAPABILITIES.production;
}

export function canUseOrganizationalLocations() {
  return INVENTORY_FOUNDATION_CAPABILITIES.organizationalLocations;
}

export function canUseCosting() {
  return INVENTORY_FOUNDATION_CAPABILITIES.costing;
}
