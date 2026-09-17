import { pool, query } from '../../config/db.js';
import { KDS_STATUSES } from '../../constants/kdsStatuses.js';
import { STOCK_TRANSACTION_TYPES } from '../../constants/stockTransactionTypes.js';
import { ApiError } from '../../utils/ApiError.js';
import { toPublicOrder } from '../../utils/order.js';

const PAYMENT_METHODS = Object.freeze({
  CASH: 'CASH',
  QR: 'QR',
});

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeId(value, fieldName) {
  const normalizedValue =
    typeof value === 'string' ? value.trim() : String(value ?? '').trim();

  if (!normalizedValue) {
    throw new ApiError(400, `${fieldName} is invalid.`);
  }

  return normalizedValue;
}

function ensurePositiveInteger(value, fieldName) {
  const normalizedValue = Number(value);

  if (!Number.isInteger(normalizedValue) || normalizedValue <= 0) {
    throw new ApiError(400, `${fieldName} must be a positive integer.`);
  }

  return normalizedValue;
}

function ensureValidNumber(value, fieldName) {
  const normalizedValue = Number(value);

  if (!Number.isFinite(normalizedValue)) {
    throw new ApiError(400, `${fieldName} is invalid.`);
  }

  if (normalizedValue < 0) {
    throw new ApiError(400, `${fieldName} cannot be negative.`);
  }

  return normalizedValue;
}

function normalizePaymentMethod(value) {
  return normalizeString(value).toUpperCase();
}

function ensureSupportedPaymentMethod(paymentMethod) {
  if (paymentMethod !== PAYMENT_METHODS.CASH && paymentMethod !== PAYMENT_METHODS.QR) {
    throw new ApiError(400, 'Payment method must be CASH or QR.');
  }
}

function buildPaymentSummary(payload, totalAmount) {
  const paymentMethod = normalizePaymentMethod(payload.paymentMethod);
  ensureSupportedPaymentMethod(paymentMethod);

  const amountReceived = ensureValidNumber(payload.amountReceived, 'Amount received');

  if (amountReceived < totalAmount) {
    throw new ApiError(400, 'Amount received must be greater than or equal to total amount.');
  }

  return {
    paymentMethod,
    amountReceived,
    changeAmount: amountReceived - totalAmount,
  };
}

function buildPlaceholders(values, startIndex = 1) {
  return values.map((_, index) => `$${startIndex + index}`).join(', ');
}

function normalizeCartItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'Cart is empty.');
  }

  const cartMap = new Map();

  items.forEach((item, index) => {
    const productId = normalizeId(item?.productId ?? item?.product_id, `Product id at row ${index + 1}`);
    const quantity = ensurePositiveInteger(item?.quantity, `Quantity at row ${index + 1}`);

    cartMap.set(productId, (cartMap.get(productId) || 0) + quantity);
  });

  return Array.from(cartMap.entries()).map(([productId, quantity]) => ({
    productId,
    quantity,
  }));
}

async function loadProductsByIds(productIds, storeId) {
  const placeholders = buildPlaceholders(productIds);
  const params = [...productIds, storeId];
  const result = await query(
    `select id,
            name,
            price,
            status
     from products
     where id in (${placeholders})
       and store_id = $${params.length}
       and deleted_at is null`,
    params,
  );

  return result.rows;
}

function ensureProductsExist(productIds, productMap) {
  for (const productId of productIds) {
    if (!productMap.has(productId)) {
      throw new ApiError(404, 'One or more products were not found.');
    }
  }
}

function ensureProductsAreActive(cartItems, productMap) {
  for (const cartItem of cartItems) {
    const product = productMap.get(cartItem.productId);

    if (product.status !== 'ACTIVE') {
      throw new ApiError(400, `Product is inactive: ${product.name}.`);
    }
  }
}

async function loadRecipeHeadersByProductIds(productIds, storeId) {
  const placeholders = buildPlaceholders(productIds);
  const params = [...productIds, storeId];
  const result = await query(
    `select id,
            product_id
     from recipes
     where product_id in (${placeholders})
       and store_id = $${params.length}
       and deleted_at is null`,
    params,
  );

  return result.rows;
}

function ensureProductsHaveRecipes(cartItems, productMap, recipeHeaders) {
  const recipeProductIds = new Set(recipeHeaders.map((row) => row.product_id));

  for (const cartItem of cartItems) {
    if (!recipeProductIds.has(cartItem.productId)) {
      const product = productMap.get(cartItem.productId);
      throw new ApiError(400, `Product has no recipe: ${product?.name || cartItem.productId}.`);
    }
  }
}

async function loadRecipeItemRows(recipeIds) {
  const result = await query(
    `select ri.recipe_id,
            ri.ingredient_id,
            ri.quantity_required,
            i.name as ingredient_name,
            i.unit
     from recipe_items ri
     join ingredients i on i.id = ri.ingredient_id
     where ri.recipe_id in (${buildPlaceholders(recipeIds)})
       and i.deleted_at is null
     order by ri.recipe_id asc, i.name asc`,
    recipeIds,
  );

  return result.rows;
}

function buildRecipeItemsByProductId(recipeHeaders, recipeItemRows, productMap) {
  const recipeIdToProductId = new Map(recipeHeaders.map((row) => [row.id, row.product_id]));
  const recipeItemsByProductId = new Map();

  for (const row of recipeItemRows) {
    const productId = recipeIdToProductId.get(row.recipe_id);

    if (!productId) {
      continue;
    }

    if (!recipeItemsByProductId.has(productId)) {
      recipeItemsByProductId.set(productId, []);
    }

    recipeItemsByProductId.get(productId).push({
      ingredientId: row.ingredient_id,
      ingredientName: row.ingredient_name,
      quantityRequired: Number(row.quantity_required || 0),
      unit: row.unit,
    });
  }

  for (const recipeHeader of recipeHeaders) {
    const productId = recipeHeader.product_id;
    const items = recipeItemsByProductId.get(productId) || [];

    if (items.length === 0) {
      const product = productMap.get(productId);
      throw new ApiError(400, `Product has no valid recipe: ${product?.name || productId}.`);
    }
  }

  return recipeItemsByProductId;
}

function buildOrderPlan(cartItems, productMap, recipeItemsByProductId) {
  const orderItems = [];
  const ingredientRequirements = new Map();
  let totalAmount = 0;

  for (const cartItem of cartItems) {
    const product = productMap.get(cartItem.productId);
    const unitPrice = Number(product.price || 0);
    const subtotal = unitPrice * cartItem.quantity;

    totalAmount += subtotal;
    orderItems.push({
      productId: product.id,
      productNameSnapshot: product.name,
      quantity: cartItem.quantity,
      unitPrice,
      subtotal,
    });

    const recipeItems = recipeItemsByProductId.get(cartItem.productId) || [];

    for (const recipeItem of recipeItems) {
      const requiredQuantity = Number(recipeItem.quantityRequired || 0) * cartItem.quantity;
      const currentRequirement = ingredientRequirements.get(recipeItem.ingredientId);

      ingredientRequirements.set(recipeItem.ingredientId, {
        ingredientId: recipeItem.ingredientId,
        ingredientName: recipeItem.ingredientName,
        requiredQuantity:
          (currentRequirement?.requiredQuantity || 0) + requiredQuantity,
      });
    }
  }

  return {
    orderItems,
    ingredientRequirements: Array.from(ingredientRequirements.values()),
    totalAmount,
  };
}

async function loadIngredientsForUpdate(client, ingredientIds, storeId) {
  const placeholders = buildPlaceholders(ingredientIds);
  const params = [...ingredientIds, storeId];
  const result = await client.query(
    `select id,
            name,
            unit,
            current_stock
     from ingredients
     where id in (${placeholders})
       and store_id = $${params.length}
       and deleted_at is null
     order by id
     for update`,
    params,
  );

  return result.rows;
}

function ensureSufficientStock(lockedIngredients, ingredientRequirementMap) {
  for (const ingredient of lockedIngredients) {
    const requirement = ingredientRequirementMap.get(ingredient.id);

    if (!requirement) {
      continue;
    }

    const currentStock = Number(ingredient.current_stock || 0);

    if (currentStock < requirement.requiredQuantity) {
      throw new ApiError(400, `Insufficient stock for ${ingredient.name}.`);
    }
  }
}

function generateOrderCodeCandidate() {
  const timestamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const randomSuffix = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');

  return `OD${timestamp}${randomSuffix}`;
}

async function generateUniqueOrderCode(client) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generateOrderCodeCandidate();
    const result = await client.query(
      `select 1
       from orders
       where order_code = $1
       limit 1`,
      [candidate],
    );

    if (!result.rows[0]) {
      return candidate;
    }
  }

  throw new ApiError(500, 'Could not generate unique order code.');
}

async function insertOrderItems(client, orderId, orderItems, storeId) {
  for (const orderItem of orderItems) {
    await client.query(
      `insert into order_items (
         order_id,
         product_id,
         product_name_snapshot,
         quantity,
         unit_price,
         subtotal,
         store_id
       )
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        orderId,
        orderItem.productId,
        orderItem.productNameSnapshot,
        orderItem.quantity,
        orderItem.unitPrice,
        orderItem.subtotal,
        storeId,
      ],
    );
  }
}

async function applyStockDeductions(client, ingredientRequirements, actorUser, orderId, orderCode, storeId) {
  const ingredientRequirementMap = new Map(
    ingredientRequirements.map((requirement) => [requirement.ingredientId, requirement]),
  );
  const lockedIngredients = await loadIngredientsForUpdate(
    client,
    ingredientRequirements.map((requirement) => requirement.ingredientId),
    storeId
  );

  if (lockedIngredients.length !== ingredientRequirements.length) {
    throw new ApiError(404, 'One or more ingredients were not found.');
  }

  ensureSufficientStock(lockedIngredients, ingredientRequirementMap);

  for (const ingredient of lockedIngredients) {
    const requirement = ingredientRequirementMap.get(ingredient.id);
    const beforeStock = Number(ingredient.current_stock || 0);
    const afterStock = beforeStock - requirement.requiredQuantity;

    await client.query(
      `update ingredients
       set current_stock = $1,
           updated_at = now()
       where id = $2`,
      [afterStock, ingredient.id],
    );

    await client.query(
      `insert into stock_transactions (
         ingredient_id,
         type,
         quantity,
         before_stock,
         after_stock,
         order_id,
         note,
         created_by,
         store_id
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        ingredient.id,
        STOCK_TRANSACTION_TYPES.ORDER_DEDUCT,
        requirement.requiredQuantity,
        beforeStock,
        afterStock,
        orderId,
        `POS order ${orderCode}`,
        actorUser.id,
        storeId,
      ],
    );
  }
}

async function findOrderHeaderByIdForStaff(orderId, staffId, storeId) {
  const result = await query(
    `select o.id,
            o.order_code,
            o.staff_id,
            u.username as staff_username,
            o.total_amount,
            o.refunded_amount,
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
       and o.staff_id = $2
       and o.store_id = $3
       and o.status in ('SUCCESS', 'PARTIALLY_REFUNDED', 'REFUNDED')
     limit 1`,
    [orderId, staffId, storeId],
  );

  return result.rows[0] || null;
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
            refunded_quantity,
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

export async function createOrder(payload, actorUser, storeId) {
  const cartItems = normalizeCartItems(payload.items);
  const note = normalizeString(payload.note);
  const productIds = cartItems.map((item) => item.productId);
  const products = await loadProductsByIds(productIds, storeId);
  const productMap = new Map(products.map((product) => [product.id, product]));

  ensureProductsExist(productIds, productMap);
  ensureProductsAreActive(cartItems, productMap);

  const recipeHeaders = await loadRecipeHeadersByProductIds(productIds, storeId);
  ensureProductsHaveRecipes(cartItems, productMap, recipeHeaders);

  const recipeItemRows = await loadRecipeItemRows(recipeHeaders.map((row) => row.id));
  const recipeItemsByProductId = buildRecipeItemsByProductId(recipeHeaders, recipeItemRows, productMap);
  const { orderItems, ingredientRequirements, totalAmount } = buildOrderPlan(
    cartItems,
    productMap,
    recipeItemsByProductId,
  );
  const paymentSummary = buildPaymentSummary(payload, totalAmount);

  const client = await pool.connect();

  try {
    await client.query('begin');

    // Check if there is an active POS session for this staff
    const activeSessionRes = await client.query(
      `select id from pos_sessions where staff_id = $1 and store_id = $2 and status = 'OPEN' limit 1`,
      [actorUser.id, storeId]
    );

    if (activeSessionRes.rows.length === 0) {
      throw new ApiError(400, 'Bạn cần mở ca bán hàng trước khi tạo đơn.');
    }

    const posSessionId = activeSessionRes.rows[0].id;

    const orderCode = await generateUniqueOrderCode(client);
    const insertOrderResult = await client.query(
      `insert into orders (
         order_code,
         staff_id,
         total_amount,
         payment_method,
         amount_received,
         change_amount,
         paid_at,
         status,
         kds_status,
         note,
         pos_session_id,
         store_id
       )
       values ($1, $2, $3, $4, $5, $6, now(), 'SUCCESS', $7, $8, $9, $10)
       returning id`,
      [
        orderCode,
        actorUser.id,
        totalAmount,
        paymentSummary.paymentMethod,
        paymentSummary.amountReceived,
        paymentSummary.changeAmount,
        KDS_STATUSES.NEW,
        note || null,
        posSessionId,
        storeId,
      ],
    );

    const orderId = insertOrderResult.rows[0].id;

    await insertOrderItems(client, orderId, orderItems, storeId);
    await applyStockDeductions(client, ingredientRequirements, actorUser, orderId, orderCode, storeId);

    await client.query('commit');

    return getOrderByIdForStaff(orderId, actorUser, storeId);
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function listOrdersForStaff(actorUser, { dateFrom, dateTo } = {}, storeId) {
  const params = [actorUser.id, storeId];
  const conditions = ['o.staff_id = $1', 'o.store_id = $2', "o.status in ('SUCCESS', 'PARTIALLY_REFUNDED', 'REFUNDED')"];

  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`o.created_at::date >= $${params.length}`);
  }

  if (dateTo) {
    params.push(dateTo);
    conditions.push(`o.created_at::date <= $${params.length}`);
  }

  const result = await query(
    `select o.id,
            o.order_code,
            o.staff_id,
            u.username as staff_username,
            o.total_amount,
            o.refunded_amount,
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
     where ${conditions.join(' and ')}
     order by o.created_at desc`,
    params,
  );

  return result.rows.map((row) => toPublicOrder(row));
}

export async function getOrderByIdForStaff(orderId, actorUser, storeId) {
  const normalizedOrderId = normalizeId(orderId, 'Order id');
  const header = await findOrderHeaderByIdForStaff(normalizedOrderId, actorUser.id, storeId);

  if (!header) {
    throw new ApiError(404, 'Order not found.');
  }

  const [order] = await buildOrdersWithItems([header]);
  return order;
}

export async function refundOrderItems(orderId, { refundAll, items, returnToStock, reason } = {}, actorUser, storeId) {
  const normalizedOrderId = normalizeId(orderId, 'Order id');
  const cleanReason = reason ? String(reason).trim() : '';
  if (!cleanReason) {
    throw new ApiError(400, 'Lý do hoàn tiền là bắt buộc.');
  }

  const client = await pool.connect();
  try {
    await client.query('begin');

    const orderRes = await client.query(
      `select id, order_code, total_amount, refunded_amount, status, staff_id
       from orders
       where id = $1 and store_id = $2 for update`,
      [normalizedOrderId, storeId]
    );

    if (orderRes.rows.length === 0) {
      throw new ApiError(404, 'Không tìm thấy đơn hàng.');
    }

    const order = orderRes.rows[0];

    if (order.status === 'REFUNDED') {
      throw new ApiError(400, 'Đơn hàng này đã được hoàn tiền toàn bộ.');
    }

    const itemsRes = await client.query(
      `select id, product_id, product_name_snapshot, quantity, unit_price, subtotal, refunded_quantity
       from order_items
       where order_id = $1 for update`,
      [normalizedOrderId]
    );
    const orderItems = itemsRes.rows;

    let refundAmountTotal = 0;
    const itemsToRefund = [];

    if (refundAll) {
      for (const item of orderItems) {
        const remainingQty = item.quantity - item.refunded_quantity;
        if (remainingQty > 0) {
          refundAmountTotal += remainingQty * Number(item.unit_price);
          itemsToRefund.push({
            itemRow: item,
            quantityToRefund: remainingQty
          });
        }
      }
    } else {
      if (!Array.isArray(items) || items.length === 0) {
        throw new ApiError(400, 'Danh sách món cần hoàn tiền trống.');
      }

      for (const reqItem of items) {
        const itemId = normalizeId(reqItem.orderItemId || reqItem.id, 'Item id');
        const qtyToRefund = ensurePositiveInteger(reqItem.refundQuantity || reqItem.quantity, 'Số lượng hoàn tiền');

        const item = orderItems.find(i => i.id === itemId);
        if (!item) {
          throw new ApiError(404, `Không tìm thấy sản phẩm có mã trong đơn hàng.`);
        }

        const remainingQty = item.quantity - item.refunded_quantity;
        if (qtyToRefund > remainingQty) {
          throw new ApiError(400, `Số lượng hoàn tiền cho sản phẩm "${item.product_name_snapshot}" vượt quá số lượng mua thực tế còn lại (tối đa: ${remainingQty}).`);
        }

        refundAmountTotal += qtyToRefund * Number(item.unit_price);
        itemsToRefund.push({
          itemRow: item,
          quantityToRefund: qtyToRefund
        });
      }
    }

    if (itemsToRefund.length === 0) {
      throw new ApiError(400, 'Không có sản phẩm nào đủ điều kiện hoàn tiền.');
    }

    for (const refundInfo of itemsToRefund) {
      const { itemRow, quantityToRefund } = refundInfo;
      const newRefundedQty = itemRow.refunded_quantity + quantityToRefund;
      await client.query(
        `update order_items
         set refunded_quantity = $1
         where id = $2`,
        [newRefundedQty, itemRow.id]
      );
    }

    const newRefundedAmount = Number(order.refunded_amount || 0) + refundAmountTotal;
    
    const allItemsRes = await client.query(
      `select quantity, refunded_quantity from order_items where order_id = $1`,
      [normalizedOrderId]
    );
    const isFullyRefunded = allItemsRes.rows.every(row => Number(row.quantity) === Number(row.refunded_quantity));
    const newStatus = isFullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

    await client.query(
      `update orders
       set refunded_amount = $1,
           status = $2,
           updated_at = now()
       where id = $3`,
      [newRefundedAmount, newStatus, normalizedOrderId]
    );

    if (returnToStock) {
      for (const refundInfo of itemsToRefund) {
        const { itemRow, quantityToRefund } = refundInfo;
        
        const recipeRes = await client.query(
          `select id from recipes where product_id = $1 and store_id = $2 and deleted_at is null limit 1`,
          [itemRow.product_id, storeId]
        );
        
        if (recipeRes.rows.length > 0) {
          const recipeId = recipeRes.rows[0].id;
          
          const recipeItemsRes = await client.query(
            `select ingredient_id, quantity_required from recipe_items where recipe_id = $1`,
            [recipeId]
          );
          
          for (const ri of recipeItemsRes.rows) {
            const ingId = ri.ingredient_id;
            const qtyNeededPerUnit = Number(ri.quantity_required);
            const totalQtyToRestore = qtyNeededPerUnit * quantityToRefund;
            
            const ingRes = await client.query(
              `select name, current_stock from ingredients where id = $1 and deleted_at is null for update`,
              [ingId]
            );
            
            if (ingRes.rows.length > 0) {
              const ing = ingRes.rows[0];
              const beforeStock = Number(ing.current_stock || 0);
              const afterStock = beforeStock + totalQtyToRestore;
              
              await client.query(
                `update ingredients set current_stock = $1, updated_at = now() where id = $2`,
                [afterStock, ingId]
              );
              
              await client.query(
                `insert into stock_transactions (
                   ingredient_id, type, quantity, before_stock, after_stock, order_id, note, created_by, store_id
                 )
                 values ($1, 'ORDER_REFUND', $2, $3, $4, $5, $6, $7, $8)`,
                [
                  ingId,
                  totalQtyToRestore,
                  beforeStock,
                  afterStock,
                  normalizedOrderId,
                  `Hoàn kho từ hoàn tiền đơn hàng ${order.order_code} - Lý do: ${cleanReason}`,
                  actorUser.id,
                  storeId
                ]
              );
            }
          }
        }
      }
    }

    await client.query('commit');
    
    const updatedHeaderRes = await client.query(
      `select o.id, o.order_code, o.staff_id, u.username as staff_username,
              o.total_amount, o.refunded_amount, o.payment_method, o.amount_received,
              o.change_amount, o.paid_at, o.status, o.kds_status, o.kds_completed_at,
              o.note, o.created_at, o.updated_at
       from orders o
       join app_users u on u.id = o.staff_id
       where o.id = $1`,
      [normalizedOrderId]
    );
    const updatedHeader = updatedHeaderRes.rows[0];
    const updatedItemsRes = await client.query(
      `select id, order_id, product_id, product_name_snapshot, quantity, unit_price, subtotal, refunded_quantity, created_at
       from order_items
       where order_id = $1`,
      [normalizedOrderId]
    );
    
    return toPublicOrder(updatedHeader, updatedItemsRes.rows);

  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function listOrdersForOwner(actorUser, { dateFrom, dateTo, staffId, status, orderCode } = {}, storeId) {
  const params = [storeId];
  const conditions = ['o.store_id = $1'];

  if (staffId) {
    params.push(staffId);
    conditions.push(`o.staff_id = $${params.length}`);
  }

  if (status) {
    params.push(status.toUpperCase());
    conditions.push(`o.status = $${params.length}`);
  } else {
    conditions.push(`o.status in ('SUCCESS', 'PARTIALLY_REFUNDED', 'REFUNDED')`);
  }

  if (orderCode) {
    params.push(`%${orderCode.trim()}%`);
    conditions.push(`o.order_code ilike $${params.length}`);
  }

  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`o.created_at::date >= $${params.length}`);
  }

  if (dateTo) {
    params.push(dateTo);
    conditions.push(`o.created_at::date <= $${params.length}`);
  }

  const whereClause = conditions.length ? `where ${conditions.join(' and ')}` : '';

  const result = await query(
    `select o.id,
            o.order_code,
            o.staff_id,
            u.username as staff_username,
            o.total_amount,
            o.refunded_amount,
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
     ${whereClause}
     order by o.created_at desc`,
    params,
  );

  return result.rows.map((row) => toPublicOrder(row));
}

export async function getOrderByIdForOwner(orderId, actorUser, storeId) {
  const normalizedOrderId = normalizeId(orderId, 'Order id');
  const result = await query(
    `select o.id,
            o.order_code,
            o.staff_id,
            u.username as staff_username,
            o.total_amount,
            o.refunded_amount,
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
       and o.status in ('SUCCESS', 'PARTIALLY_REFUNDED', 'REFUNDED')
     limit 1`,
    [normalizedOrderId, storeId],
  );

  const header = result.rows[0] || null;

  if (!header) {
    throw new ApiError(404, 'Order not found.');
  }

  const [order] = await buildOrdersWithItems([header]);
  return order;
}
