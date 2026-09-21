import { pool, query } from '../../config/db.js';
import { KDS_STATUSES } from '../../constants/kdsStatuses.js';
import { STOCK_TRANSACTION_TYPES } from '../../constants/stockTransactionTypes.js';
import { ApiError } from '../../utils/ApiError.js';
import { toPublicOrder } from '../../utils/order.js';
import { postLegacyIngredientChanges } from '../inventory/inventory-legacy-posting.service.js';
import { postInventoryMovements } from '../inventory/inventory-posting.service.js';
import { getEffectiveNegativeStockPolicy } from '../inventory/inventory-policy.service.js';
import { addDecimal, divideDecimal, multiplyDecimal } from '../inventory/inventory-decimal.js';

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

function normalizeRefundOperationId(value) {
  const operationId = typeof value === 'string' ? value.trim() : '';
  if (!operationId || operationId.length > 200) {
    throw new ApiError(400, 'operationId is required for a refund and must be a non-empty identifier.');
  }
  return operationId;
}

function refundOperationFingerprint(orderId, { refundAll, items, returnToStock, reason }) {
  const normalizedItems = Array.isArray(items)
    ? items.map((item) => ({ id: String(item.orderItemId || item.id || '').trim(), quantity: Number(item.refundQuantity || item.quantity) }))
      .sort((left, right) => left.id.localeCompare(right.id))
    : [];
  return JSON.stringify({ orderId, refundAll: Boolean(refundAll), returnToStock: Boolean(returnToStock), reason: String(reason || '').trim(), items: normalizedItems });
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
    `select p.id,
            case
              when p.parent_product_id is not null then parent.name || ' - ' || p.size_name
              else p.name
            end as name,
            p.price,
            p.status,
            p.is_group,
            p.parent_product_id,
            parent.id as parent_id,
            parent.status as parent_status,
            inventory.id as inventory_item_id,
            inventory.product_inventory_mode,
            inventory.quantity_on_hand as inventory_quantity,
            inventory.low_stock_threshold as inventory_low_stock_threshold,
            inventory.current_unit_cost as inventory_current_unit_cost,
            inventory.inventory_value as inventory_value,
            inventory.cost_status as inventory_cost_status
     from products p
     left join products parent
       on parent.id = p.parent_product_id
      and parent.store_id = p.store_id
      and parent.deleted_at is null
     left join inventory_items inventory on inventory.product_id=p.id and inventory.store_id=p.store_id
     where p.id in (${placeholders})
       and p.store_id = $${params.length}
       and p.deleted_at is null`,
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

    if (product.is_group) {
      throw new ApiError(400, `Product size group cannot be sold directly: ${product.name}.`);
    }

    const effectiveStatus = product.parent_product_id ? product.parent_status : product.status;
    if (product.parent_product_id && !product.parent_id) {
      throw new ApiError(400, `Product size parent is unavailable: ${product.name}.`);
    }
    if (effectiveStatus !== 'ACTIVE') {
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

async function loadRecipeItemRows(recipeIds) {
  if (!recipeIds.length) return [];

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

function buildRecipeItemsByProductId(recipeHeaders, recipeItemRows) {
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
    const recipeItems = recipeItemsByProductId.get(cartItem.productId) || [];
    const inventoryBehavior = product.product_inventory_mode === 'STOCKED'
      ? 'STOCKED_PRODUCT'
      : recipeItems.length ? 'RECIPE_ON_SALE' : 'NONE';
    if (inventoryBehavior === 'STOCKED_PRODUCT' && !product.inventory_item_id) throw new ApiError(409, 'Stocked Product has no inventory item.');
    const itemIngredientRequirements = recipeItems.map((recipeItem) => ({
      ingredientId: recipeItem.ingredientId,
      ingredientName: recipeItem.ingredientName,
      requiredQuantity: Number(recipeItem.quantityRequired || 0) * cartItem.quantity,
    }));

    totalAmount += subtotal;
    orderItems.push({
      productId: product.id,
      productNameSnapshot: product.name,
      quantity: cartItem.quantity,
      unitPrice,
      subtotal,
      inventoryBehavior,
      inventoryItemId: product.inventory_item_id || null,
      ingredientRequirements: itemIngredientRequirements,
    });

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
  if (!ingredientIds.length) return [];
  const placeholders = ingredientIds.map((_, index) => `$${index + 1}`).join(', ');
  const params = [...ingredientIds, storeId];
  const result = await client.query(
    `select ingredient.id,
            ingredient.name,
            ingredient.unit,
            inventory.quantity_on_hand as current_stock,
            ingredient.is_preparation
     from ingredients ingredient
     join inventory_items inventory on inventory.ingredient_id=ingredient.id and inventory.store_id=ingredient.store_id
     where ingredient.id in (${placeholders})
       and ingredient.store_id = $${params.length}
       and ingredient.deleted_at is null
       and inventory.item_type in ('RAW_INGREDIENT','PREPARATION')
     order by ingredient.id
     for update of inventory`,
    params,
  );

  return result.rows;
}

// function ensureSufficientStock removed, logic handled recursively in applyStockDeductions

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

const ORDER_ITEM_INSERT_COLUMNS = Object.freeze([
  'order_id',
  'product_id',
  'product_name_snapshot',
  'quantity',
  'unit_price',
  'subtotal',
  'inventory_snapshot_recorded_at',
  'inventory_behavior_snapshot',
  'inventory_snapshot_version',
  'store_id',
]);

function buildOrderItemInsertValues(orderId, orderItem, storeId) {
  return [
    orderId,
    orderItem.productId,
    orderItem.productNameSnapshot,
    orderItem.quantity,
    orderItem.unitPrice,
    orderItem.subtotal,
    orderItem.inventoryBehavior,
    2,
    storeId,
  ];
}

export async function insertOrderItems(client, orderId, orderItems, storeId) {
  const insertedItems = [];
  for (const orderItem of orderItems) {
    const values = buildOrderItemInsertValues(orderId, orderItem, storeId);
    const result = await client.query(
      `insert into order_items (${ORDER_ITEM_INSERT_COLUMNS.join(', ')})
       values ($1, $2, $3, $4, $5, $6, now(), $7, $8, $9)
       returning id`,
      values,
    );
    insertedItems.push({ ...orderItem, id: result.rows[0].id });
  }

  return insertedItems;
}

async function loadAllPossibleIngredients(client, initialIngredientIds, storeId) {
  const allIds = new Set(initialIngredientIds);
  const queue = [...initialIngredientIds];
  
  while (queue.length > 0) {
    const currentId = queue.shift();
    const recipeRes = await client.query(
      `select id from recipes where ingredient_id = $1 and store_id = $2 and deleted_at is null`,
      [currentId, storeId]
    );
    if (recipeRes.rowCount > 0) {
      const itemsRes = await client.query(
        `select ingredient_id from recipe_items where recipe_id = $1`,
        [recipeRes.rows[0].id]
      );
      for (const item of itemsRes.rows) {
        if (!allIds.has(item.ingredient_id)) {
          allIds.add(item.ingredient_id);
          queue.push(item.ingredient_id);
        }
      }
    }
  }
  return Array.from(allIds);
}

async function applyStockDeductions(client, ingredientRequirements, actorUser, orderId, orderItemId, orderCode, storeId) {
  // 1. Identify all possible ingredients (including deep raw ingredients) to lock them in order
  const initialIds = ingredientRequirements.map(req => req.ingredientId);
  const allPossibleIds = await loadAllPossibleIngredients(client, initialIds, storeId);
  
  // 2. Lock all involved ingredients sorted by ID to prevent deadlocks
  const lockedIngredients = await loadIngredientsForUpdate(client, allPossibleIds, storeId);
  const lockedMap = new Map(lockedIngredients.map(ing => [ing.id, ing]));
  
  // 3. Process requirements recursively in-memory using the locked stocks
  const finalDeductions = new Map(); // ingredientId -> deduction amount
  const queue = [...ingredientRequirements];
  
  while (queue.length > 0) {
    const req = queue.shift();
    const ingredient = lockedMap.get(req.ingredientId);
    
    if (!ingredient) {
      throw new ApiError(404, `Ingredient not found: ${req.ingredientId}`);
    }
    
    const existingDeduction = finalDeductions.get(ingredient.id) || 0;
    const currentStock = Number(ingredient.current_stock || 0);
    const availableStock = Math.max(0, currentStock - existingDeduction);
    
    let toDeduct = 0;
    let shortage = 0;
    
    if (availableStock >= req.requiredQuantity) {
      toDeduct = req.requiredQuantity;
    } else {
      toDeduct = availableStock;
      shortage = req.requiredQuantity - availableStock;
    }
    
    if (toDeduct > 0) {
      finalDeductions.set(ingredient.id, existingDeduction + toDeduct);
    }
    
    if (shortage > 0) {
      if (ingredient.is_preparation) {
        const recipeRes = await client.query(
          `select id, yield_amount from recipes where ingredient_id = $1 and store_id = $2 and deleted_at is null`,
          [ingredient.id, storeId]
        );
        if (recipeRes.rowCount === 0) {
          throw new ApiError(400, `Bán thành phẩm "${ingredient.name}" thiếu công thức để quy đổi.`);
        }
        
        const yieldAmount = Number(recipeRes.rows[0].yield_amount);
        const recipeId = recipeRes.rows[0].id;
        
        const itemsRes = await client.query(
          `select ingredient_id, quantity_required from recipe_items where recipe_id = $1`,
          [recipeId]
        );
        
        const ratio = shortage / yieldAmount;
        for (const item of itemsRes.rows) {
          queue.push({
            ingredientId: item.ingredient_id,
            requiredQuantity: Number(item.quantity_required) * ratio
          });
        }
      } else {
        throw new ApiError(400, `Không đủ tồn kho cho "${ingredient.name}". Cần thêm ${shortage.toFixed(2)} ${ingredient.unit}.`);
      }
    }
  }
  
  // 4. Post the entire recipe plan atomically from inventory_items authority. The plan above
  // preserves Preparation shortage expansion: only the unavailable shortage is exploded.
  const posted = await postLegacyIngredientChanges(client, {
    storeId, actorId: actorUser.id, operationKey: `order:${orderId}:sale`,
    changes: [...finalDeductions.entries()].filter(([, amount]) => amount > 0).map(([ingredientId, amount]) => ({
      ingredientId, quantityDelta: -amount, movementType: 'SALE_OUT', operation: 'ORDER_SALE', orderId, orderItemId,
    })),
  });
  for (const [ingredientId, amountToDeduct] of finalDeductions.entries()) {
    if (amountToDeduct <= 0) continue;
    
    const ingredient = lockedMap.get(ingredientId);
    const inventoryItem = posted.itemsByIngredient.get(String(ingredient.id));
    const movement = posted.byInventoryItem.get(inventoryItem.id);

    if (!posted.alreadyPosted) await client.query(
      `insert into stock_transactions (
         ingredient_id, type, quantity, before_stock, after_stock, order_id, note, created_by, store_id
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        ingredient.id,
        STOCK_TRANSACTION_TYPES.ORDER_DEDUCT,
        amountToDeduct,
        movement.before_quantity,
        movement.after_quantity,
        orderId,
        `POS order ${orderCode}`,
        actorUser.id,
        storeId,
      ]
    );
  }

  return Array.from(finalDeductions.entries()).map(([ingredientId, quantity]) => ({
    ingredientId,
    quantity,
  }));
}

async function insertOrderItemInventoryConsumptions(client, orderItemId, deductions, storeId) {
  for (const deduction of deductions) {
    if (deduction.quantity <= 0) continue;
    await client.query(
      `insert into order_item_inventory_consumptions (
         order_item_id, ingredient_id, store_id, quantity
       ) values ($1, $2, $3, $4)`,
      [orderItemId, deduction.ingredientId, storeId, deduction.quantity],
    );
  }
}

async function postStockedProductSale(client, orderItem, actorUser, orderId, storeId) {
  const policyResult = await client.query(`select allow_negative_stock,negative_stock_policy_configured_at from stores where id=$1`, [storeId]);
  const policy = policyResult.rows[0];
  const allowNegative = Boolean(policy?.negative_stock_policy_configured_at && policy.allow_negative_stock);
  const quantityDelta = `-${orderItem.quantity}`;
  return postInventoryMovements(client, {
    storeId, actorId: actorUser.id, allowNegative,
    postingGroupKey: `order:${orderId}:sale:${orderItem.id}`,
    movements: [{ inventoryItemId: orderItem.inventoryItemId, orderId, orderItemId: orderItem.id,
      postingKey: `order:${orderId}:sale:${orderItem.inventoryItemId}:item:${orderItem.id}`,
      movementType: 'SALE_OUT', quantityDelta, metadata: { source: 'ORDER_SALE', inventoryBehavior: 'STOCKED_PRODUCT' } }],
    prepareLockedMovements: ({ lockedItems, movements }) => {
      const item = lockedItems[0];
      if (!item || item.item_type !== 'PRODUCT' || item.id !== orderItem.inventoryItemId || item.product_is_group) throw new ApiError(409, 'Stocked Product inventory item is unavailable.');
      const movement = movements[0];
      if (item.cost_status === 'AVAILABLE' && item.current_unit_cost !== null && item.inventory_value !== null) {
        const valueDelta = multiplyDecimal(String(item.current_unit_cost), quantityDelta);
        movement.unitCostSnapshot = String(item.current_unit_cost); movement.valueDelta = valueDelta;
        movement.balanceMutation = { inventoryValueDelta: valueDelta };
      }
    },
  });
}

async function loadSnapshotRestorations(client, itemsToRefund, storeId) {
  if (!itemsToRefund.length) {
    return [];
  }

  const legacyItem = itemsToRefund.find(
    ({ itemRow }) => itemRow.inventory_snapshot_recorded_at === null,
  );
  if (legacyItem) {
    throw new ApiError(
      400,
      `Order item "${legacyItem.itemRow.product_name_snapshot}" has no inventory snapshot. Complete stock reconciliation manually.`,
    );
  }

  const values = [];
  const params = [];
  for (const { itemRow, quantityToRefund } of itemsToRefund) {
    const baseIndex = params.length + 1;
    values.push(`($${baseIndex}::uuid, $${baseIndex + 1}::numeric, $${baseIndex + 2}::numeric)`);
    params.push(itemRow.id, itemRow.refunded_quantity, quantityToRefund);
  }
  params.push(storeId);

  const result = await client.query(
    `with refund_lines(order_item_id, refunded_quantity_before, refund_quantity) as (
       values ${values.join(', ')}
     )
     select consumption.ingredient_id,
            (array_agg(consumption.order_item_id order by consumption.order_item_id))[1] as order_item_id,
            sum(
              consumption.quantity * (
                (refund_lines.refunded_quantity_before + refund_lines.refund_quantity) / order_item.quantity
                - refund_lines.refunded_quantity_before / order_item.quantity
              )
            ) as restore_quantity
     from refund_lines
     join order_items order_item on order_item.id = refund_lines.order_item_id
     join order_item_inventory_consumptions consumption
       on consumption.order_item_id = order_item.id
      and consumption.store_id = $${params.length}
     where order_item.store_id = $${params.length}
     group by consumption.ingredient_id
     having sum(
       consumption.quantity * (
         (refund_lines.refunded_quantity_before + refund_lines.refund_quantity) / order_item.quantity
         - refund_lines.refunded_quantity_before / order_item.quantity
       )
     ) > 0
     order by consumption.ingredient_id`,
    params,
  );

  return result.rows;
}

async function restoreSnapshotInventory(client, restorations, order, actorUser, reason, storeId, operationId) {
  if (!restorations.length) return;

  const ingredientIds = restorations.map((restoration) => restoration.ingredient_id);
  const lockedIngredients = await client.query(
    `select ingredient.id
     from ingredients ingredient
     join inventory_items inventory on inventory.ingredient_id=ingredient.id and inventory.store_id=ingredient.store_id
     where ingredient.id = any($1::uuid[])
       and ingredient.store_id = $2
       and ingredient.deleted_at is null
       and inventory.item_type in ('RAW_INGREDIENT','PREPARATION')
     order by ingredient.id
     for update of inventory`,
    [ingredientIds, storeId],
  );
  if (lockedIngredients.rows.length !== ingredientIds.length) {
    throw new ApiError(400, 'A snapshotted ingredient is unavailable for stock restoration. Reconcile stock manually.');
  }

  const orderItemIds = [...new Set(restorations.map((row) => row.order_item_id).filter(Boolean))];
  const evidence = await client.query(
    `select inventory.ingredient_id,
            sum(-movement.quantity_delta) as original_quantity,
            sum(-movement.value_delta) as original_value,
            max(movement.unit_cost_snapshot) as original_unit_cost,
            array_agg(movement.id order by movement.id) as original_movement_ids
       from inventory_movements movement
       join inventory_items inventory on inventory.id=movement.inventory_item_id
      where movement.order_id=$1 and movement.order_item_id=any($2::uuid[])
        and movement.movement_type='SALE_OUT' and inventory.ingredient_id=any($3::uuid[])
      group by inventory.ingredient_id`,
    [order.id, orderItemIds, restorations.map((row) => row.ingredient_id)],
  );
  const evidenceByIngredient = new Map(evidence.rows.map((row) => [String(row.ingredient_id), row]));
  const operationKey = `refund:${operationId}`;
  const posted = await postLegacyIngredientChanges(client, {
    storeId, actorId: actorUser.id, operationKey,
    changes: restorations.map((row) => {
      const original = evidenceByIngredient.get(String(row.ingredient_id));
      if (!original || original.original_value === null || Number(original.original_quantity) <= 0) {
        throw new ApiError(409, 'ORIGINAL_INVENTORY_VALUE_SNAPSHOT_REQUIRED');
      }
      const restoredValue = multiplyDecimal(String(original.original_value), divideDecimal(String(row.restore_quantity), String(original.original_quantity)));
      return { ingredientId: row.ingredient_id, quantityDelta: row.restore_quantity, movementType: 'REFUND_IN', operation: 'ORDER_REFUND', orderId: order.id, orderItemId: row.order_item_id, unitCostSnapshot: String(original.original_unit_cost), valueDelta: restoredValue, metadata: { operationId, orderItemId: row.order_item_id, originalSaleMovementIds: original.original_movement_ids, originalSaleQuantity: original.original_quantity, originalSaleValue: original.original_value, restoredQuantity: row.restore_quantity, restoredHistoricalValue: restoredValue, refundOperationFingerprint: order.refund_operation_fingerprint } };
    }),
  });
  for (const restoration of restorations) {
    const item = posted.itemsByIngredient.get(String(restoration.ingredient_id));
    const movement = posted.byInventoryItem.get(item.id);

    if (!posted.alreadyPosted) await client.query(
      `insert into stock_transactions (
         ingredient_id, type, quantity, before_stock, after_stock, order_id, note, created_by, store_id
       ) values ($1, 'ORDER_REFUND', $2, $3, $4, $5, $6, $7, $8)`,
      [
        restoration.ingredient_id,
        restoration.restore_quantity,
        movement.before_quantity,
        movement.after_quantity,
        order.id,
        `Inventory return for order ${order.order_code}: ${reason}`,
        actorUser.id,
        storeId,
      ],
    );
  }
}

async function restoreStockedProductInventory(client, itemsToRefund, order, actorUser, storeId, operationId) {
  const stocked = itemsToRefund.filter(({ itemRow }) => itemRow.inventory_behavior_snapshot === 'STOCKED_PRODUCT');
  if (!stocked.length) return;
  const originals = await client.query(`select order_item_id,inventory_item_id,quantity_delta,value_delta,unit_cost_snapshot
    from inventory_movements where order_id=$1 and order_item_id=any($2::uuid[]) and movement_type='SALE_OUT' order by order_item_id,id`, [order.id, stocked.map(({ itemRow }) => itemRow.id)]);
  const byOrderItem = new Map(originals.rows.map((row) => [row.order_item_id, row]));
  const restorePlans = stocked.map(({ itemRow, quantityToRefund }) => {
    const original = byOrderItem.get(itemRow.id);
    if (!original) throw new ApiError(409, 'Original stocked Product sale movement is unavailable for return.');
    const quantity = String(quantityToRefund);
    const proportion = divideDecimal(quantity, String(itemRow.quantity));
    const originalValue = original.value_delta === null ? null : String(original.value_delta).replace(/^-/, '');
    return { itemRow, original, quantity, value: originalValue === null ? null : multiplyDecimal(originalValue, proportion) };
  });
  await postInventoryMovements(client, { storeId, actorId: actorUser.id, postingGroupKey: `refund:${order.id}:stocked`, movements: restorePlans.map((plan) => ({
    inventoryItemId: plan.original.inventory_item_id, orderId: order.id, orderItemId: plan.itemRow.id, movementType: 'REFUND_IN', quantityDelta: plan.quantity,
    postingKey: `refund:${operationId}:${plan.itemRow.id}:${plan.original.inventory_item_id}`,
    unitCostSnapshot: plan.original.unit_cost_snapshot === null ? null : String(plan.original.unit_cost_snapshot), valueDelta: plan.value,
    metadata: { source: 'ORDER_REFUND', inventoryBehavior: 'STOCKED_PRODUCT', operationId, refundOperationFingerprint: order.refund_operation_fingerprint, originalSaleMovementId: plan.original.id, originalSaleValue: plan.original.value_delta },
  })), prepareLockedMovements: ({ lockedItems, movements }) => {
    const items = new Map(lockedItems.map((item) => [item.id, item]));
    for (const movement of movements) { const item = items.get(movement.inventoryItemId); const plan = restorePlans.find((entry) => entry.original.inventory_item_id === item.id);
      if (!item || item.item_type !== 'PRODUCT' || item.product_is_group) throw new ApiError(409, 'Original stocked Product inventory item is unavailable for return.');
      if (plan.value !== null) { const resultingValue = addDecimal(String(item.inventory_value ?? '0'), plan.value); const resultingQuantity = addDecimal(String(item.quantity_on_hand), plan.quantity); movement.balanceMutation = { resultingInventoryValue: resultingValue, resultingUnitCost: divideDecimal(resultingValue, resultingQuantity), resultingCostStatus: 'AVAILABLE' }; }
    }
  } });
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
  const recipeItemRows = await loadRecipeItemRows(recipeHeaders.map((row) => row.id));
  const recipeItemsByProductId = buildRecipeItemsByProductId(recipeHeaders, recipeItemRows);
  const { orderItems, totalAmount } = buildOrderPlan(
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

    const persistedOrderItems = await insertOrderItems(client, orderId, orderItems, storeId);
    for (const orderItem of persistedOrderItems) {
      if (orderItem.inventoryBehavior === 'STOCKED_PRODUCT') {
        await postStockedProductSale(client, orderItem, actorUser, orderId, storeId);
      } else if (orderItem.inventoryBehavior === 'RECIPE_ON_SALE') {
        const deductions = await applyStockDeductions(client, orderItem.ingredientRequirements, actorUser, orderId, orderItem.id, orderCode, storeId);
        await insertOrderItemInventoryConsumptions(client, orderItem.id, deductions, storeId);
      }
    }

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

export async function refundOrderItems(orderId, { refundAll, items, returnToStock, reason, operationId: rawOperationId } = {}, actorUser, storeId, { client: callerClient } = {}) {
  const normalizedOrderId = normalizeId(orderId, 'Order id');
  const operationId = normalizeRefundOperationId(rawOperationId);
  const operationFingerprint = refundOperationFingerprint(normalizedOrderId, { refundAll, items, returnToStock, reason });
  const cleanReason = reason ? String(reason).trim() : '';
  if (!cleanReason) {
    throw new ApiError(400, 'Lý do hoàn tiền là bắt buộc.');
  }

  const ownsTransaction = !callerClient;
  const client = callerClient || await pool.connect();
  try {
    if (ownsTransaction) await client.query('begin');

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

    const existingOperation = await client.query(
      `select metadata
       from inventory_movements
       where store_id=$1 and movement_type='REFUND_IN' and metadata->>'operationId'=$2
       limit 1`,
      [storeId, operationId],
    );
    if (existingOperation.rows[0]) {
      if (existingOperation.rows[0].metadata?.refundOperationFingerprint !== operationFingerprint) {
        throw new ApiError(409, 'operationId was already used with different refund content.');
      }
      if (ownsTransaction) await client.query('commit');
      return getOrderByIdForOwner(order.id, actorUser, storeId);
    }

    if (order.status === 'REFUNDED') {
      throw new ApiError(400, 'Đơn hàng này đã được hoàn tiền toàn bộ.');
    }

    const itemsRes = await client.query(
       `select id, product_id, product_name_snapshot, quantity, unit_price, subtotal, refunded_quantity,
               inventory_snapshot_recorded_at,inventory_behavior_snapshot,inventory_snapshot_version
        from order_items
        where order_id = $1 and store_id = $2 for update`,
       [normalizedOrderId, storeId]
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

      const requestedOrderItemIds = new Set();
      for (const reqItem of items) {
        const itemId = normalizeId(reqItem.orderItemId || reqItem.id, 'Item id');
        if (requestedOrderItemIds.has(itemId)) {
          throw new ApiError(400, 'Each order item may appear only once in a refund request.');
        }
        requestedOrderItemIds.add(itemId);
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

    order.refund_operation_fingerprint = operationFingerprint;

    const recipeRefundItems = itemsToRefund.filter(({ itemRow }) => itemRow.inventory_behavior_snapshot !== 'STOCKED_PRODUCT');
    const snapshotRestorations = returnToStock ? await loadSnapshotRestorations(client, recipeRefundItems, storeId) : [];

    for (const refundInfo of itemsToRefund) {
      const { itemRow, quantityToRefund } = refundInfo;
      const newRefundedQty = itemRow.refunded_quantity + quantityToRefund;
      await client.query(
        `update order_items
         set refunded_quantity = $1
          where id = $2 and store_id = $3`,
         [newRefundedQty, itemRow.id, storeId]
      );
    }

    const newRefundedAmount = Number(order.refunded_amount || 0) + refundAmountTotal;
    
    const allItemsRes = await client.query(
      `select quantity, refunded_quantity from order_items where order_id = $1 and store_id = $2`,
      [normalizedOrderId, storeId]
    );
    const isFullyRefunded = allItemsRes.rows.every(row => Number(row.quantity) === Number(row.refunded_quantity));
    const newStatus = isFullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

    await client.query(
      `update orders
        set refunded_amount = $1,
           status = $2,
           updated_at = now()
        where id = $3 and store_id = $4`,
       [newRefundedAmount, newStatus, normalizedOrderId, storeId]
    );

    if (returnToStock) {
      await restoreSnapshotInventory(
        client,
        snapshotRestorations,
        order,
        actorUser,
        cleanReason,
        storeId,
        operationId,
      );
      await restoreStockedProductInventory(client, itemsToRefund, order, actorUser, storeId, operationId);
    }

    if (ownsTransaction) await client.query('commit');
    
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
    if (ownsTransaction) await client.query('rollback');
    throw error;
  } finally {
    if (ownsTransaction) client.release();
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
