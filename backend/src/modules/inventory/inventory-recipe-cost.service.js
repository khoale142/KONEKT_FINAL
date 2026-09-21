import { query } from '../../config/db.js';
import { addDecimal, compareDecimal, divideDecimal, multiplyDecimal } from './inventory-decimal.js';

function unavailable(reason, details = {}) { return { available: false, status: 'UNAVAILABLE', reason, ...details }; }

async function loadRecipeCostGraph(storeId, client) {
  const result = await client.query(`
    select r.id as recipe_id, r.yield_amount, target.id as target_item_id, target.item_type as target_type,
           target.product_inventory_mode, ri.quantity_required, component.id as component_item_id,
           component.current_unit_cost as component_cost, component.cost_status as component_status
    from recipes r
    join inventory_items target on target.store_id=r.store_id
      and ((r.ingredient_id is not null and target.ingredient_id=r.ingredient_id)
        or (r.product_id is not null and target.product_id=r.product_id))
    left join recipe_items ri on ri.recipe_id=r.id
    left join inventory_items component on component.store_id=r.store_id and component.ingredient_id=ri.ingredient_id
    where r.store_id=$1 and r.deleted_at is null
      and (target.item_type='PREPARATION' or (target.item_type='PRODUCT' and target.product_inventory_mode='RECIPE_ON_SALE'))
    order by r.id,ri.id`, [storeId]);
  const nodes = new Map();
  for (const row of result.rows) {
    if (!nodes.has(row.target_item_id)) nodes.set(row.target_item_id, { id: row.target_item_id, recipeId: row.recipe_id, yieldAmount: String(row.yield_amount), components: [] });
    if (row.component_item_id) nodes.get(row.target_item_id).components.push({ id: row.component_item_id, quantity: String(row.quantity_required), cost: row.component_cost === null ? null : String(row.component_cost), status: row.component_status });
  }
  return nodes;
}

export async function calculateRecipeDerivedCosts(storeId, client = { query }) {
  const nodes = await loadRecipeCostGraph(storeId, client);
  const memo = new Map(); const visiting = new Set();
  const visit = (id) => {
    if (memo.has(id)) return memo.get(id);
    if (visiting.has(id)) return unavailable('RECIPE_CYCLE_DETECTED', { inventoryItemId: id });
    const node = nodes.get(id);
    if (!node || compareDecimal(node.yieldAmount, '0') <= 0 || !node.components.length) return unavailable('RECIPE_CONFIGURATION_UNAVAILABLE', { inventoryItemId: id });
    visiting.add(id); let total = '0';
    for (const component of node.components) {
      if (compareDecimal(component.quantity, '0') === 0) continue;
      const componentResult = nodes.has(component.id)
        ? visit(component.id)
        : component.status === 'AVAILABLE' && component.cost !== null
          ? { available: true, unitCost: component.cost }
          : unavailable('COMPONENT_COST_UNAVAILABLE', { inventoryItemId: component.id });
      if (!componentResult.available) {
        const result = unavailable('COMPONENT_COST_UNAVAILABLE', { inventoryItemId: id, componentInventoryItemId: component.id, componentReason: componentResult.reason });
        visiting.delete(id); memo.set(id, result); return result;
      }
      total = addDecimal(total, multiplyDecimal(componentResult.unitCost, component.quantity));
    }
    const result = { available: true, status: 'AVAILABLE', inventoryItemId: id, recipeId: node.recipeId, inputCost: total, yieldAmount: node.yieldAmount, unitCost: divideDecimal(total, node.yieldAmount), componentInventoryItemIds: node.components.map((component) => component.id) };
    visiting.delete(id); memo.set(id, result); return result;
  };
  return [...nodes.keys()].map((id) => ({
    ...visit(id),
    componentInventoryItemIds: nodes.get(id).components.map((component) => component.id),
  }));
}

// Called by future receipt/production posting inside its transaction. It intentionally has no
// route and is never called by reads, so cache rebuilding cannot become an N+1 GET behavior.
export async function recalculateDependentRecipeCosts(client, { storeId, sourceInventoryItemIds = null }) {
  const results = await calculateRecipeDerivedCosts(storeId, client);
  const changedSources = sourceInventoryItemIds ? new Set(sourceInventoryItemIds) : null;
  // Find every dependent recursively, so a raw-cost change refreshes Preparation and then
  // any recipe-on-sale Product that uses that Preparation.
  if (changedSources) {
    let expanded = true;
    while (expanded) {
      expanded = false;
      for (const result of results) {
        const dependencies = result.componentInventoryItemIds || [];
        if (!changedSources.has(result.inventoryItemId) && dependencies.some((id) => changedSources.has(id))) {
          changedSources.add(result.inventoryItemId); expanded = true;
        }
      }
    }
  }
  const affected = changedSources ? results.filter((result) => changedSources.has(result.inventoryItemId)) : results;
  for (const result of affected) {
    const cost = result.available ? result.unitCost : null;
    await client.query(`update inventory_items set current_unit_cost=$1::numeric,cost_status=$2::inventory_cost_status,
      cost_version=cost_version + case when current_unit_cost is distinct from $1::numeric or cost_status is distinct from $2::inventory_cost_status then 1 else 0 end,
      updated_at=now() where id=$3 and store_id=$4`, [cost, result.status, result.inventoryItemId, storeId]);
  }
  return affected;
}
