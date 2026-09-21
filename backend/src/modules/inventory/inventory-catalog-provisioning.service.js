export async function provisionCatalogInventoryItem(client, { storeId, catalogId, itemType, unit = null, lowStockThreshold = null, productInventoryMode = null }) {
  const columns = itemType === 'PRODUCT'
    ? 'store_id,item_type,product_id,quantity_on_hand,product_inventory_mode'
    : 'store_id,item_type,ingredient_id,quantity_on_hand,low_stock_threshold';
  const values = itemType === 'PRODUCT'
    ? [storeId, itemType, catalogId, 'RECIPE_ON_SALE']
    : [storeId, itemType, catalogId, lowStockThreshold];
  const result = itemType === 'PRODUCT'
    ? await client.query(`insert into inventory_items(${columns}) values($1,$2::inventory_item_type,$3,0,$4::inventory_product_inventory_mode) returning id`, values)
    : await client.query(`insert into inventory_items(${columns}) values($1,$2::inventory_item_type,$3,0,$4) returning id`, values);
  const inventoryItemId = result.rows[0].id;
  if (unit && String(unit).trim()) await client.query(`insert into inventory_item_units(inventory_item_id,name,level,is_base,multiplier_to_parent,factor_to_base) values($1,$2,0,true,1,1)`, [inventoryItemId, String(unit).trim()]);
  return inventoryItemId;
}

export async function synchronizeSafeBaseUnit(client, { storeId, inventoryItemId, nextUnit, ingredientId = null }) {
  const item = await client.query('select id from inventory_items where id=$1 and store_id=$2', [inventoryItemId, storeId]);
  if (!item.rows[0]) return;
  const state = await client.query(`select count(*)::int as unit_count, count(*) filter(where is_base)::int as base_count from inventory_item_units where inventory_item_id=$1 and is_active`, [inventoryItemId]);
  const history = await client.query(`select (select count(*) from inventory_movements where inventory_item_id=$1) + (select count(*) from inventory_document_items di join inventory_documents d on d.id=di.document_id where di.inventory_item_id=$1 and d.status in ('APPROVED','RECEIVED','REVERSED')) as count`, [inventoryItemId]);
  const recipeUse = ingredientId ? await client.query(`select count(*)::int as count from recipe_items where ingredient_id=$1`, [ingredientId]) : { rows: [{ count: 0 }] };
  if (Number(state.rows[0].unit_count)!==1 || Number(state.rows[0].base_count)!==1 || Number(history.rows[0].count)!==0 || Number(recipeUse.rows[0].count)!==0) {
    const error = new Error('INVENTORY_BASE_UNIT_CHANGE_CONFLICT: Existing inventory configuration or history prevents changing the base unit.'); error.statusCode=409; error.code='INVENTORY_BASE_UNIT_CHANGE_CONFLICT'; throw error;
  }
  await client.query(`update inventory_item_units set name=$1,symbol=$1,updated_at=now() where inventory_item_id=$2 and is_base`, [nextUnit, inventoryItemId]);
}

export async function ensureCatalogInventoryProvisioned(client, args) {
  const column = args.itemType==='PRODUCT' ? 'product_id' : 'ingredient_id';
  const existing = await client.query(`select id from inventory_items where store_id=$1 and ${column}=$2`, [args.storeId,args.catalogId]);
  if (existing.rows[0]) return existing.rows[0].id;
  return provisionCatalogInventoryItem(client,args);
}
