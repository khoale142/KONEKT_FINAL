export function toPublicProduct(row) {
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    imageUrl: row.image_url || null,
    categoryId: row.category_id || null,
    category: row.category_id
      ? { id: row.category_id, name: row.category_name, scope: row.category_scope }
      : null,
    price: Number(row.price || 0),
    unit: row.unit ?? null,
    status: row.status,
    hasRecipe: Boolean(row.has_recipe),
    inventoryBehavior: row.product_inventory_mode === 'STOCKED' ? 'STOCKED_PRODUCT' : row.has_recipe ? 'RECIPE_ON_SALE' : 'NONE',
    inventory: row.product_inventory_mode === 'STOCKED' ? {
      quantityOnHand: Number(row.inventory_quantity_on_hand || 0),
      lowStockThreshold: row.inventory_low_stock_threshold === null || row.inventory_low_stock_threshold === undefined ? null : Number(row.inventory_low_stock_threshold),
      isLowStock: Boolean(row.inventory_is_low_stock), isOutOfStock: Number(row.inventory_quantity_on_hand || 0) <= 0,
      canSell: Boolean(row.inventory_can_sell),
    } : null,
    isGroup: Boolean(row.is_group),
    parentProductId: row.parent_product_id || null,
    sizeName: row.size_name || null,
    sortOrder: row.sort_order === null || row.sort_order === undefined
      ? null
      : Number(row.sort_order),
    variants: Array.isArray(row.variants) ? row.variants : undefined,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}
