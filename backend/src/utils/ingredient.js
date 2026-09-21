export function toPublicIngredient(row) {
  if (!row) return null;

  const currentStock = Number(row.current_stock || 0);
  const lowStockThreshold = Number(row.low_stock_threshold || 0);

  return {
    id: row.id,
    name: row.name,
    categoryId: row.category_id || null,
    category: row.category_id
      ? { id: row.category_id, name: row.category_name, scope: row.category_scope }
      : null,
    unit: row.unit,
    currentStock,
    lowStockThreshold,
    isLowStock:
      row.is_low_stock !== undefined
        ? Boolean(row.is_low_stock)
        : currentStock <= lowStockThreshold,
    isPreparation: Boolean(row.is_preparation),
    isGroup: Boolean(row.is_group),
    parentIngredientId: row.parent_ingredient_id || null,
    sizeName: row.size_name || null,
    hasRecipe: Boolean(row.has_recipe),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}
