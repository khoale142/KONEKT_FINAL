import { query } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { multiplyDecimal, requireNonNegativeDecimal } from './inventory-decimal.js';

export function inventoryBaseUnitRequiredError() {
  const error = new ApiError(409, 'Sản phẩm chưa có đơn vị tính. Vui lòng cập nhật sản phẩm trước khi thực hiện nghiệp vụ kho.', [{ code: 'INVENTORY_BASE_UNIT_REQUIRED' }]);
  error.code = 'INVENTORY_BASE_UNIT_REQUIRED';
  return error;
}

export async function requireInventoryBaseUnit(inventoryItemId, storeId, client = { query }) {
  const result = await client.query(`
    select id, name, symbol, factor_to_base
    from inventory_item_units
    where inventory_item_id=$1 and is_base and is_active
    limit 1`, [inventoryItemId]);
  const unit = result.rows[0];
  if (!unit) throw inventoryBaseUnitRequiredError();
  return unit;
}

export async function convertToBase({ inventoryItemId, unitId, quantity, storeId, client = { query } }) {
  if (!inventoryItemId || !unitId || !storeId) throw new ApiError(400, 'Inventory item, unit, and Store are required.');
  const enteredQuantity = requireNonNegativeDecimal(quantity, 'Quantity');
  const item = await client.query('select id from inventory_items where id=$1 and store_id=$2', [inventoryItemId, storeId]);
  if (!item.rows[0]) throw new ApiError(404, 'Inventory item not found in this Store.');
  const baseUnit = await requireInventoryBaseUnit(inventoryItemId, storeId, client);
  const unitResult = await client.query(`
    select id,name,symbol,level,parent_unit_id,multiplier_to_parent,factor_to_base
    from inventory_item_units where id=$1 and inventory_item_id=$2 and is_active`, [unitId, inventoryItemId]);
  const unit = unitResult.rows[0];
  if (!unit) throw new ApiError(400, 'Entered unit is not active for this inventory item.');
  const pathResult = await client.query(`
    with recursive path as (
      select id,name,symbol,level,parent_unit_id,multiplier_to_parent,factor_to_base
      from inventory_item_units where id=$1
      union all
      select parent.id,parent.name,parent.symbol,parent.level,parent.parent_unit_id,parent.multiplier_to_parent,parent.factor_to_base
      from inventory_item_units parent join path child on child.parent_unit_id=parent.id
    ) select * from path order by level desc`, [unit.id]);
  return {
    inventoryItemId,
    enteredQuantity,
    enteredUnit: { id: unit.id, name: unit.name, symbol: unit.symbol },
    factorToBase: String(unit.factor_to_base),
    baseQuantity: multiplyDecimal(enteredQuantity, String(unit.factor_to_base)),
    baseUnit: { id: baseUnit.id, name: baseUnit.name, symbol: baseUnit.symbol },
    conversionPath: pathResult.rows.map((row) => ({ id: row.id, name: row.name, symbol: row.symbol, level: Number(row.level), multiplierToParent: String(row.multiplier_to_parent), factorToBase: String(row.factor_to_base) })),
  };
}
