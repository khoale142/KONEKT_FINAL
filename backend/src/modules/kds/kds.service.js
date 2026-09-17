import { query } from '../../config/db.js';
import { KDS_STATUSES } from '../../constants/kdsStatuses.js';
import { ApiError } from '../../utils/ApiError.js';
import { toPublicOrder } from '../../utils/order.js';

function normalizeId(value, fieldName) {
  const normalizedValue =
    typeof value === 'string' ? value.trim() : String(value ?? '').trim();

  if (!normalizedValue) {
    throw new ApiError(400, `${fieldName} is invalid.`);
  }

  return normalizedValue;
}

function buildPlaceholders(values, startIndex = 1) {
  return values.map((_, index) => `$${startIndex + index}`).join(', ');
}

async function loadOrderItemRows(orderIds) {
  if (!orderIds.length) {
    return [];
  }

  const result = await query(
    `select id,
            order_id,
            product_id,
            product_name_snapshot,
            quantity,
            unit_price,
            subtotal,
            created_at
     from order_items
     where order_id in (${buildPlaceholders(orderIds)})
     order by created_at asc`,
    orderIds,
  );

  return result.rows;
}

function groupOrderItemsByOrderId(orderItemRows) {
  const itemMap = new Map();

  for (const row of orderItemRows) {
    if (!itemMap.has(row.order_id)) {
      itemMap.set(row.order_id, []);
    }

    itemMap.get(row.order_id).push(row);
  }

  return itemMap;
}

async function buildOrdersWithItems(headers) {
  if (!headers.length) {
    return [];
  }

  const orderItemRows = await loadOrderItemRows(headers.map((header) => header.id));
  const itemMap = groupOrderItemsByOrderId(orderItemRows);

  return headers.map((header) => toPublicOrder(header, itemMap.get(header.id) || []));
}

async function loadOrderHeadersByKdsStatus(kdsStatus, storeId, { newestFirst = false } = {}) {
  const sortField =
    kdsStatus === KDS_STATUSES.COMPLETED ? 'coalesce(o.kds_completed_at, o.updated_at, o.created_at)' : 'o.created_at';
  const sortDirection = newestFirst ? 'desc' : 'asc';

  const result = await query(
    `select o.id,
            o.order_code,
            o.staff_id,
            u.username as staff_username,
            o.total_amount,
            o.payment_method,
            o.amount_received,
            o.change_amount,
            o.paid_at,
            o.status,
            o.kds_status,
            o.kds_completed_at,
            o.kds_completed_by,
            o.note,
            o.created_at,
            o.updated_at
     from orders o
     join app_users u on u.id = o.staff_id
     where o.status = 'SUCCESS'
       and o.store_id = $2
       and o.kds_status = $1
     order by ${sortField} ${sortDirection}, o.created_at asc`,
    [kdsStatus, storeId],
  );

  return result.rows;
}

async function findOrderHeaderById(orderId, storeId) {
  const result = await query(
    `select o.id,
            o.order_code,
            o.staff_id,
            u.username as staff_username,
            o.total_amount,
            o.payment_method,
            o.amount_received,
            o.change_amount,
            o.paid_at,
            o.status,
            o.kds_status,
            o.kds_completed_at,
            o.kds_completed_by,
            o.note,
            o.created_at,
            o.updated_at
     from orders o
     join app_users u on u.id = o.staff_id
     where o.id = $1
       and o.store_id = $2
       and o.status = 'SUCCESS'
     limit 1`,
    [orderId, storeId],
  );

  return result.rows[0] || null;
}

export async function listKdsOrdersForStaff(actorUser, storeId) {
  const [newHeaders, completedHeaders] = await Promise.all([
    loadOrderHeadersByKdsStatus(KDS_STATUSES.NEW, storeId),
    loadOrderHeadersByKdsStatus(KDS_STATUSES.COMPLETED, storeId, { newestFirst: true }),
  ]);

  const [newOrders, completedOrders] = await Promise.all([
    buildOrdersWithItems(newHeaders),
    buildOrdersWithItems(completedHeaders),
  ]);

  return {
    newOrders,
    completedOrders,
  };
}

export async function completeKdsOrder(orderId, actorUser, storeId) {
  const normalizedOrderId = normalizeId(orderId, 'Order id');
  const updateResult = await query(
    `update orders
     set kds_status = $1,
         kds_completed_at = now(),
         kds_completed_by = $2,
         updated_at = now()
     where id = $3
       and store_id = $4
       and status = 'SUCCESS'
       and kds_status = $5
     returning id`,
    [
      KDS_STATUSES.COMPLETED,
      actorUser.id,
      normalizedOrderId,
      storeId,
      KDS_STATUSES.NEW,
    ],
  );

  if (!updateResult.rows[0]) {
    const existingOrder = await findOrderHeaderById(normalizedOrderId, storeId);

    if (!existingOrder) {
      throw new ApiError(404, 'Order not found.');
    }

    if (existingOrder.kds_status === KDS_STATUSES.COMPLETED) {
      throw new ApiError(409, 'Order has already been completed.');
    }

    throw new ApiError(400, 'Order cannot be completed.');
  }

  const [order] = await buildOrdersWithItems([
    await findOrderHeaderById(normalizedOrderId, storeId),
  ]);

  return order;
}
