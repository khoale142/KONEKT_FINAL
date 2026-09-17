import { query } from '../../config/db.js';

function toNumber(value) {
  return Number(value || 0);
}

function normalizePositiveInteger(value) {
  const normalizedValue = Number(value);

  if (!Number.isInteger(normalizedValue) || normalizedValue <= 0) {
    return null;
  }

  return normalizedValue;
}

export async function listRevenueReport(storeId, { dateFrom, dateTo } = {}) {
  const params = [storeId];
  const conditions = ['store_id = $1'];

  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`order_date >= $${params.length}`);
  }

  if (dateTo) {
    params.push(dateTo);
    conditions.push(`order_date <= $${params.length}`);
  }

  const whereClause = `where ${conditions.join(' and ')}`;

  const result = await query(
    `select order_date, total_orders, total_revenue, total_refunded
     from v_daily_revenue
     ${whereClause}
     order by order_date desc`,
    params,
  );

  return result.rows.map((row) => ({
    orderDate: row.order_date,
    totalOrders: toNumber(row.total_orders),
    totalRevenue: toNumber(row.total_revenue),
    totalRefunded: toNumber(row.total_refunded),
  }));
}

export async function listBestSellingProducts(storeId, { limit } = {}) {
  const normalizedLimit = normalizePositiveInteger(limit);
  const params = [storeId];
  const limitClause = normalizedLimit ? `limit $2` : '';

  if (normalizedLimit) {
    params.push(normalizedLimit);
  }

  const result = await query(
    `select product_id, product_name, total_quantity_sold as total_quantity, total_revenue
     from v_best_selling_products
     where store_id = $1
     order by total_quantity_sold desc, total_revenue desc, product_name asc
     ${limitClause}`,
    params,
  );

  return result.rows.map((row) => ({
    productId: row.product_id,
    productName: row.product_name,
    quantitySold: toNumber(row.total_quantity),
    totalRevenue: toNumber(row.total_revenue),
  }));
}

export async function listLowStockIngredients(storeId) {
  const result = await query(
    `select ingredient_id as id, ingredient_name as name, unit, current_stock, low_stock_threshold
     from v_low_stock_ingredients
     where store_id = $1
     order by (low_stock_threshold - current_stock) desc, name asc`,
    [storeId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    unit: row.unit,
    currentStock: toNumber(row.current_stock),
    lowStockThreshold: toNumber(row.low_stock_threshold),
  }));
}

export async function listDiscardReport(storeId, { dateFrom, dateTo } = {}) {
  const params = [storeId];
  const conditions = ["st.store_id = $1", "st.note like '[HỦY HÀNG]%'"];

  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`st.created_at >= $${params.length}`);
  }

  if (dateTo) {
    params.push(dateTo);
    conditions.push(`st.created_at <= $${params.length}`);
  }

  const whereClause = `where ${conditions.join(' and ')}`;

  const result = await query(
    `select st.id, st.ingredient_id, i.name as ingredient_name, i.unit, st.quantity, st.before_stock, st.after_stock, st.note, st.created_at, u.full_name as creator_name
     from stock_transactions st
     join ingredients i on i.id = st.ingredient_id
     left join app_users u on u.id = st.created_by
     ${whereClause}
     order by st.created_at desc`,
    params,
  );

  return result.rows.map((row) => ({
    id: row.id,
    ingredientId: row.ingredient_id,
    ingredientName: row.ingredient_name,
    unit: row.unit,
    quantity: toNumber(row.quantity),
    beforeStock: toNumber(row.before_stock),
    afterStock: toNumber(row.after_stock),
    note: row.note,
    createdAt: row.created_at,
    creatorName: row.creator_name || 'Hệ thống',
  }));
}
