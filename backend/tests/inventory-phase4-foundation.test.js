import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { calculateMovingWeightedAverage, calculateProductionCost } from '../src/modules/inventory/inventory-cost.service.js';
import { calculateRecipeDerivedCosts } from '../src/modules/inventory/inventory-recipe-cost.service.js';
import { convertToBase } from '../src/modules/inventory/inventory-unit-conversion.service.js';
import { requireStoreManager } from '../src/middlewares/role.middleware.js';

function conversionClient({ base = { id: 'base', name: 'g', symbol: 'g', factor_to_base: '1' }, unit = { id: 'unit', name: 'package', symbol: 'pkg', level: 1, parent_unit_id: 'base', multiplier_to_parent: '500', factor_to_base: '500' } } = {}) {
  const rows = [[{ id: 'item' }], [base], [unit], [unit, base]];
  return { query: async () => ({ rows: rows.shift() || [] }) };
}

describe('Inventory Phase 4 foundations', () => {
  it('converts base, package, and carton quantities using exact server factors', async () => {
    const base = await convertToBase({ inventoryItemId: 'item', unitId: 'base', quantity: '2', storeId: 'store', client: conversionClient({ unit: { id: 'base', name: 'g', symbol: 'g', level: 0, parent_unit_id: null, multiplier_to_parent: '1', factor_to_base: '1' } }) });
    expect(base.baseQuantity).toBe('2');
    const packageUnit = { id: 'package', name: 'package', symbol: 'pkg', level: 1, parent_unit_id: 'base', multiplier_to_parent: '500', factor_to_base: '500' };
    const packageResult = await convertToBase({ inventoryItemId: 'item', unitId: 'package', quantity: '2', storeId: 'store', client: conversionClient({ unit: packageUnit }) });
    expect(packageResult.baseQuantity).toBe('1000');
    const carton = { id: 'carton', name: 'carton', symbol: 'ctn', level: 2, parent_unit_id: 'package', multiplier_to_parent: '24', factor_to_base: '12000' };
    const cartonResult = await convertToBase({ inventoryItemId: 'item', unitId: 'carton', quantity: '2', storeId: 'store', client: conversionClient({ unit: carton }) });
    expect(cartonResult.baseQuantity).toBe('24000');
  });

  it('rejects a missing catalog base unit with the reusable business code', async () => {
    const rows = [[{ id: 'item' }], []]; const client = { query: async () => ({ rows: rows.shift() || [] }) };
    await expect(convertToBase({ inventoryItemId: 'item', unitId: 'unit', quantity: '1', storeId: 'store', client })).rejects.toMatchObject({ code: 'INVENTORY_BASE_UNIT_REQUIRED' });
  });

  it('keeps WAC exact and never assumes an unknown prior value is zero', () => {
    expect(calculateMovingWeightedAverage({ quantityOnHand: '0', inventoryValue: null, currentUnitCost: null, receiptBaseQuantity: '10', receiptTotalValue: '100000' }).projectedCurrentUnitCost).toBe('10000');
    expect(calculateMovingWeightedAverage({ quantityOnHand: '2', inventoryValue: '20000', currentUnitCost: '10000', receiptBaseQuantity: '8', receiptTotalValue: '96000' }).projectedCurrentUnitCost).toBe('11600');
    expect(calculateMovingWeightedAverage({ quantityOnHand: '2', inventoryValue: null, currentUnitCost: null, receiptBaseQuantity: '8', receiptTotalValue: '96000' })).toMatchObject({ available: false, reason: 'UNKNOWN_EXISTING_VALUE_REQUIRES_RECONCILIATION' });
    expect(calculateMovingWeightedAverage({ quantityOnHand: '-1', inventoryValue: null, currentUnitCost: null, receiptBaseQuantity: '1', receiptTotalValue: '1' })).toMatchObject({ available: false, reason: 'NEGATIVE_QUANTITY_REQUIRES_POLICY' });
  });

  it('derives Preparation and nested Preparation costs, and propagates unavailable component cost', async () => {
    const graphRows = [
      { recipe_id: 'r1', yield_amount: '2', target_item_id: 'prep-a', quantity_required: '10', component_item_id: 'raw', component_cost: '5', component_status: 'AVAILABLE' },
      { recipe_id: 'r2', yield_amount: '1', target_item_id: 'prep-b', quantity_required: '3', component_item_id: 'prep-a', component_cost: null, component_status: 'UNAVAILABLE' },
    ];
    const derived = await calculateRecipeDerivedCosts('store', { query: async () => ({ rows: graphRows }) });
    expect(derived.find((r) => r.inventoryItemId === 'prep-a').unitCost).toBe('25');
    expect(derived.find((r) => r.inventoryItemId === 'prep-b').unitCost).toBe('75');
    const missing = await calculateRecipeDerivedCosts('store', { query: async () => ({ rows: [{ ...graphRows[0], component_cost: null, component_status: 'UNAVAILABLE' }] }) });
    expect(missing[0]).toMatchObject({ available: false, reason: 'COMPONENT_COST_UNAVAILABLE' });
  });

  it('uses attempted quantity, not accepted quantity, for production standard cost', () => {
    expect(calculateProductionCost({ attemptedQuantity: '10', acceptedQuantity: '8', failedQuantity: '2', inputCost: '100000' })).toMatchObject({ standardUnitCost: '10000', acceptedValue: '80000', productionLossValue: '20000' });
  });

  it('retains database guards for level 3, cross-item parents, and cycles', async () => {
    const migration = await readFile(new URL('../src/seed/run_inventory_foundation_phase1_migration.js', import.meta.url), 'utf8');
    expect(migration).toContain('level between 0 and 2');
    expect(migration).toContain('Inventory unit parent must belong to the same inventory item');
    expect(migration).toContain('Inventory unit hierarchy cannot contain a cycle');
  });

  it('allows only manager/owner workspace roles to configure foundation data', () => {
    const middleware = requireStoreManager();
    let staffError; middleware({ workspace: { type: 'STORE', storeId: 's', role: 'STAFF', isOwner: false } }, {}, (error) => { staffError = error; });
    expect(staffError.statusCode).toBe(403);
    let managerError = 'not-called'; middleware({ workspace: { type: 'STORE', storeId: 's', role: 'MANAGER', isOwner: false } }, {}, (error) => { managerError = error; });
    expect(managerError).toBeUndefined();
  });
});
