import { pool, query } from '../../config/db.js';
import { STOCK_TRANSACTION_TYPES } from '../../constants/stockTransactionTypes.js';
import { ApiError } from '../../utils/ApiError.js';
import { toPublicIngredient } from '../../utils/ingredient.js';
import { buildStructuredStockNote } from '../../utils/stockNote.js';
import { toPublicStockTransaction } from '../../utils/stockTransaction.js';
import { postLegacyIngredientChanges } from '../inventory/inventory-legacy-posting.service.js';

const STOCK_NOTE_CONTEXTS = Object.freeze({
  BATCH_IMPORT: 'BATCH_IMPORT',
  DAILY_COUNT: 'DAILY_COUNT',
});

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeType(value) {
  return normalizeString(value).toUpperCase();
}

function normalizeIngredientId(value) {
  const normalizedValue = normalizeString(value);

  if (!normalizedValue) {
    throw new ApiError(400, 'Ingredient ID is required.');
  }

  return normalizedValue;
}

function ensurePositiveNumber(value, fieldName) {
  const normalizedValue = Number(value);

  if (!Number.isFinite(normalizedValue)) {
    throw new ApiError(400, `${fieldName} is invalid.`);
  }

  if (normalizedValue <= 0) {
    throw new ApiError(400, `${fieldName} must be greater than 0.`);
  }

  return normalizedValue;
}

function ensureNonNegativeNumber(value, fieldName) {
  const normalizedValue = Number(value);

  if (!Number.isFinite(normalizedValue)) {
    throw new ApiError(400, `${fieldName} is invalid.`);
  }

  if (normalizedValue < 0) {
    throw new ApiError(400, `${fieldName} cannot be negative.`);
  }

  return normalizedValue;
}

function ensureValidTransactionType(type) {
  if (!Object.values(STOCK_TRANSACTION_TYPES).includes(type)) {
    throw new ApiError(400, 'Stock transaction type is invalid.');
  }
}

function ensureArrayWithItems(items, fieldName) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, `${fieldName} must contain at least one item.`);
  }
}

function ensureNoDuplicateIngredientIds(items) {
  const seenIngredientIds = new Set();

  for (const item of items) {
    if (seenIngredientIds.has(item.ingredientId)) {
      throw new ApiError(400, `Duplicate ingredient detected: ${item.ingredientId}.`);
    }

    seenIngredientIds.add(item.ingredientId);
  }
}

function ensureIsoDate(value, fieldName) {
  const normalizedValue = normalizeString(value);

  if (!normalizedValue) {
    throw new ApiError(400, `${fieldName} is required.`);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
    throw new ApiError(400, `${fieldName} must be in YYYY-MM-DD format.`);
  }

  const parsedDate = new Date(`${normalizedValue}T00:00:00.000Z`);

  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== normalizedValue) {
    throw new ApiError(400, `${fieldName} is invalid.`);
  }

  return normalizedValue;
}

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function generateSessionCode(prefix) {
  const timestamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  return `${prefix}-${timestamp}-${randomSuffix}`;
}

function mergeNotes(commonNote, lineNote) {
  const parts = [normalizeString(commonNote), normalizeString(lineNote)].filter(Boolean);
  return parts.join(' | ');
}

function normalizeBatchImportItems(items) {
  ensureArrayWithItems(items, 'Import items');

  const normalizedItems = items.map((item, index) => ({
    ingredientId: normalizeIngredientId(item.ingredientId ?? item.ingredient_id),
    quantity: ensurePositiveNumber(item.quantity, `Import quantity at row ${index + 1}`),
    note: normalizeString(item.note ?? item.notes),
  }));

  ensureNoDuplicateIngredientIds(normalizedItems);

  return normalizedItems;
}

function normalizeDailyCountItems(items) {
  ensureArrayWithItems(items, 'Stock count items');

  const normalizedItems = items.map((item, index) => ({
    ingredientId: normalizeIngredientId(item.ingredientId ?? item.ingredient_id),
    actualStock: ensureNonNegativeNumber(
      item.actualStock ?? item.actual_stock,
      `Actual stock at row ${index + 1}`,
    ),
    note: normalizeString(item.note ?? item.notes),
  }));

  ensureNoDuplicateIngredientIds(normalizedItems);

  return normalizedItems;
}

async function getTransactionRowById(client, transactionId, storeId) {
  const result = await client.query(
    `select st.id,
            st.ingredient_id,
            i.name as ingredient_name,
            st.type,
            st.quantity,
            st.before_stock,
            st.after_stock,
            st.note,
            st.order_id,
            u.username as created_by_username,
            st.created_at
     from stock_transactions st
     join ingredients i on i.id = st.ingredient_id
     left join app_users u on u.id = st.created_by
     where st.id = $1
       and st.store_id = $2
     limit 1`,
    [transactionId, storeId],
  );

  return result.rows[0] || null;
}

async function insertStockTransaction(client, payload, storeId) {
  const result = await client.query(
    `insert into stock_transactions (
       ingredient_id,
       type,
       quantity,
       before_stock,
       after_stock,
       note,
       created_by,
       store_id
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning id`,
    [
      payload.ingredientId,
      payload.type,
      payload.quantity,
      payload.beforeStock,
      payload.afterStock,
      payload.note,
      payload.createdBy,
      storeId,
    ],
  );

  return getTransactionRowById(client, result.rows[0].id, storeId);
}

async function getIngredientForUpdate(client, ingredientId, storeId) {
  const result = await client.query(
    `select id,
            name,
            unit,
            current_stock,
            low_stock_threshold,
            created_at,
            updated_at
     from ingredients
     where id = $1
       and store_id = $2
       and deleted_at is null
     limit 1
     for update`,
    [ingredientId, storeId],
  );

  return result.rows[0] || null;
}

async function getIngredientsForUpdate(client, ingredientIds, storeId) {
  const result = await client.query(
    `select id,
            name,
            unit,
            current_stock,
            low_stock_threshold,
            created_at,
            updated_at
     from ingredients
     where id = any($1::uuid[])
       and store_id = $2
       and deleted_at is null
     for update`,
    [ingredientIds, storeId],
  );

  return new Map(result.rows.map((row) => [row.id, row]));
}

function ensureAllIngredientsFound(ingredientsById, items) {
  for (const item of items) {
    if (!ingredientsById.has(item.ingredientId)) {
      throw new ApiError(404, `Ingredient not found: ${item.ingredientId}.`);
    }
  }
}

function requiredOperationId(value) {
  const id = normalizeString(value);
  if (!id) throw new ApiError(400, 'operationId is required for an idempotent inventory operation.');
  return id;
}

async function applyStockChange({ actorUser, ingredientId, note, quantity, type, movementType, storeId, operationId }) {
  const client = await pool.connect();

  try {
    await client.query('begin');

    const ingredient = await getIngredientForUpdate(client, ingredientId, storeId);

    if (!ingredient) {
      throw new ApiError(404, 'Ingredient not found.');
    }

    const quantityDelta = type === STOCK_TRANSACTION_TYPES.IMPORT ? quantity : -quantity;
    const posted = await postLegacyIngredientChanges(client, {
      storeId, actorId: actorUser.id, operationKey: `legacy:${requiredOperationId(operationId)}`,
      changes: [{ ingredientId, quantityDelta, movementType, operation: type }],
    });
    const inventoryItem = posted.itemsByIngredient.get(String(ingredientId));
    const movement = posted.byInventoryItem.get(inventoryItem.id);
    let transactionRow = null;
    if (!posted.alreadyPosted) transactionRow = await insertStockTransaction(client, {
      ingredientId, type, quantity, beforeStock: movement.before_quantity, afterStock: movement.after_quantity,
      note, createdBy: actorUser.id,
    }, storeId);
    const updatedIngredientRow = await getIngredientForUpdate(client, ingredientId, storeId);

    await client.query('commit');

    return {
      ingredient: toPublicIngredient(updatedIngredientRow),
      transaction: transactionRow ? toPublicStockTransaction(transactionRow) : null,
    };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function importStock(payload, actorUser, storeId) {
  const ingredientId = normalizeIngredientId(payload.ingredientId ?? payload.ingredient_id);
  const quantity = ensurePositiveNumber(payload.quantity, 'Import quantity');
  const note = normalizeString(payload.note ?? payload.notes);

  return applyStockChange({
    actorUser,
    ingredientId,
    note,
    quantity,
    type: STOCK_TRANSACTION_TYPES.IMPORT,
    movementType: 'RECEIPT_IN', operationId: payload.operationId ?? payload.operation_id,
    storeId,
  });
}

export async function adjustStock(payload, actorUser, storeId) {
  const ingredientId = normalizeIngredientId(payload.ingredientId ?? payload.ingredient_id);
  const quantity = ensurePositiveNumber(payload.quantity, 'Adjustment quantity');
  const note = normalizeString(payload.note ?? payload.notes);

  return applyStockChange({
    actorUser,
    ingredientId,
    note,
    quantity,
    type: STOCK_TRANSACTION_TYPES.ADJUST,
    movementType: 'MANUAL_ADJUST', operationId: payload.operationId ?? payload.operation_id,
    storeId,
  });
}

export async function importStockBatch(payload, actorUser, storeId) {
  const items = normalizeBatchImportItems(payload.items);
  const commonNote = normalizeString(payload.note ?? payload.notes);
  const eventDate = getTodayIsoDate();
  const sessionCode = generateSessionCode('IMP');
  const operationId = requiredOperationId(payload.operationId ?? payload.operation_id);
  const client = await pool.connect();

  try {
    await client.query('begin');

    const ingredientIds = items.map((item) => item.ingredientId);
    const ingredientsById = await getIngredientsForUpdate(client, ingredientIds, storeId);

    ensureAllIngredientsFound(ingredientsById, items);

    const posted = await postLegacyIngredientChanges(client, {
      storeId, actorId: actorUser.id, operationKey: `legacy:${operationId}`,
      changes: items.map((item) => ({ ingredientId: item.ingredientId, quantityDelta: item.quantity, movementType: 'RECEIPT_IN', operation: 'IMPORT_BATCH', metadata: { sessionCode } })),
    });
    const results = [];
    for (const item of items) {
      const ingredient = ingredientsById.get(item.ingredientId);
      const mergedNote = mergeNotes(commonNote, item.note);
      const inventoryItem = posted.itemsByIngredient.get(String(item.ingredientId));
      const movement = posted.byInventoryItem.get(inventoryItem.id);
      const transactionRow = posted.alreadyPosted ? null : await insertStockTransaction(client, {
        ingredientId: item.ingredientId, type: STOCK_TRANSACTION_TYPES.IMPORT, quantity: item.quantity,
        beforeStock: movement.before_quantity, afterStock: movement.after_quantity,
        note: buildStructuredStockNote({
          context: STOCK_NOTE_CONTEXTS.BATCH_IMPORT,
          eventDate,
          sessionCode,
          note: mergedNote,
        }),
        createdBy: actorUser.id,
      }, storeId);

      const updatedIngredientRow = await getIngredientForUpdate(client, item.ingredientId, storeId);

      results.push({
        ingredientId: item.ingredientId,
        ingredientName: updatedIngredientRow.name,
        inputQuantity: item.quantity,
        note: mergedNote,
        ingredient: toPublicIngredient(updatedIngredientRow),
        transaction: transactionRow ? toPublicStockTransaction(transactionRow) : null,
      });
    }

    await client.query('commit');

    return {
      mode: 'IMPORT',
      eventDate,
      sessionCode,
      processedCount: results.length,
      changedCount: results.length,
      unchangedCount: 0,
      items: results,
    };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function countStockDaily(payload, actorUser, storeId) {
  const items = normalizeDailyCountItems(payload.items);
  const commonNote = normalizeString(payload.note ?? payload.notes);
  const eventDate = payload.countDate
    ? ensureIsoDate(payload.countDate, 'Count date')
    : getTodayIsoDate();
  const sessionCode = generateSessionCode('CNT');
  const operationId = requiredOperationId(payload.operationId ?? payload.operation_id);
  const client = await pool.connect();

  try {
    await client.query('begin');

    const ingredientIds = items.map((item) => item.ingredientId);
    const ingredientsById = await getIngredientsForUpdate(client, ingredientIds, storeId);

    ensureAllIngredientsFound(ingredientsById, items);

    const authorityRows = await client.query(`select ingredient_id,quantity_on_hand from inventory_items
      where store_id=$1 and ingredient_id=any($2::uuid[]) for update`, [storeId, ingredientIds]);
    const authorityByIngredient = new Map(authorityRows.rows.map((row) => [String(row.ingredient_id), row]));
    if (authorityByIngredient.size !== ingredientIds.length) throw new ApiError(409, 'An Ingredient is missing its authoritative inventory item.');
    const changes = items.map((item) => ({ ...item, theoreticalStock: Number(authorityByIngredient.get(String(item.ingredientId)).quantity_on_hand) }))
      .filter((item) => item.actualStock !== item.theoreticalStock);
    const posted = changes.length ? await postLegacyIngredientChanges(client, {
      storeId, actorId: actorUser.id, operationKey: `legacy:${operationId}`,
      changes: changes.map((item) => ({ ingredientId: item.ingredientId, quantityDelta: item.actualStock - item.theoreticalStock, movementType: 'COUNT_ADJUST', operation: 'DAILY_COUNT', metadata: { sessionCode } })),
    }) : { alreadyPosted: false, itemsByIngredient: new Map(), byInventoryItem: new Map() };
    const results = [];
    let changedCount = 0;

    for (const item of items) {
      const ingredient = ingredientsById.get(item.ingredientId);
      const theoreticalStock = Number(authorityByIngredient.get(String(item.ingredientId)).quantity_on_hand);
      const actualStock = item.actualStock;
      const differenceQuantity = actualStock - theoreticalStock;
      const mergedNote = mergeNotes(commonNote, item.note);
      let updatedIngredientRow = ingredient;
      let transaction = null;

      if (differenceQuantity !== 0) {
        changedCount += 1;
        const inventoryItem = posted.itemsByIngredient.get(String(item.ingredientId));
        const movement = posted.byInventoryItem.get(inventoryItem.id);
        const transactionRow = posted.alreadyPosted ? null : await insertStockTransaction(client, {
          ingredientId: item.ingredientId, type: STOCK_TRANSACTION_TYPES.ADJUST, quantity: Math.abs(differenceQuantity),
          beforeStock: movement.before_quantity, afterStock: movement.after_quantity,
          note: buildStructuredStockNote({
            context: STOCK_NOTE_CONTEXTS.DAILY_COUNT,
            eventDate,
            sessionCode,
            note: mergedNote,
          }),
          createdBy: actorUser.id,
        }, storeId);

        transaction = transactionRow ? toPublicStockTransaction(transactionRow) : null;
        updatedIngredientRow = await getIngredientForUpdate(client, item.ingredientId, storeId);
      }

      results.push({
        ingredientId: item.ingredientId,
        ingredientName: updatedIngredientRow.name,
        unit: updatedIngredientRow.unit,
        theoreticalStock,
        actualStock,
        differenceQuantity,
        changed: differenceQuantity !== 0,
        note: mergedNote,
        ingredient: toPublicIngredient(updatedIngredientRow),
        transaction,
      });
    }

    await client.query('commit');

    return {
      mode: 'DAILY_COUNT',
      eventDate,
      sessionCode,
      processedCount: results.length,
      changedCount,
      unchangedCount: results.length - changedCount,
      items: results,
    };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function listStockTransactions({
  ingredientId,
  type,
  dateFrom,
  dateTo,
} = {}, storeId) {
  const params = [storeId];
  const conditions = ['st.store_id = $1'];
  const normalizedType = normalizeType(type);

  if (ingredientId) {
    params.push(ingredientId);
    conditions.push(`st.ingredient_id = $${params.length}`);
  }

  if (normalizedType && normalizedType !== 'ALL') {
    ensureValidTransactionType(normalizedType);
    params.push(normalizedType);
    conditions.push(`st.type = $${params.length}`);
  }

  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`st.created_at::date >= $${params.length}`);
  }

  if (dateTo) {
    params.push(dateTo);
    conditions.push(`st.created_at::date <= $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `where ${conditions.join(' and ')}` : '';

  const result = await query(
    `select st.id,
            st.ingredient_id,
            i.name as ingredient_name,
            st.type,
            st.quantity,
            st.before_stock,
            st.after_stock,
            st.note,
            st.order_id,
            u.username as created_by_username,
            st.created_at
     from stock_transactions st
     join ingredients i on i.id = st.ingredient_id
     left join app_users u on u.id = st.created_by
     ${whereClause}
     order by st.created_at desc`,
    params,
  );

  return result.rows.map(toPublicStockTransaction);
}

export async function getStockForecast(storeId) {
  const result = await query(`
    SELECT 
      i.id AS ingredient_id,
      i.name AS name,
      i.unit AS unit,
      i.current_stock::numeric AS current_stock,
      i.low_stock_threshold::numeric AS low_stock_threshold,
      COALESCE(SUM(oi.quantity * ri.quantity_required), 0)::numeric AS total_consumed
    FROM public.ingredients i
    LEFT JOIN public.recipe_items ri ON ri.ingredient_id = i.id
    LEFT JOIN public.recipes r ON r.id = ri.recipe_id AND r.deleted_at IS NULL
    LEFT JOIN public.order_items oi ON oi.product_id = r.product_id
    LEFT JOIN public.orders o ON o.id = oi.order_id AND o.status = 'SUCCESS' AND o.created_at >= NOW() - INTERVAL '30 days'
    WHERE i.store_id = $1 AND i.deleted_at IS NULL
    GROUP BY i.id, i.name, i.unit, i.current_stock, i.low_stock_threshold
    ORDER BY i.name ASC
  `, [storeId]);

  const forecasts = result.rows.map(row => {
    const currentStock = Number(row.current_stock);
    const lowStockThreshold = Number(row.low_stock_threshold);
    const totalConsumed = Number(row.total_consumed);
    
    const averageDailyUsage = Math.round((totalConsumed / 30.0) * 100) / 100;
    const daysRemaining = averageDailyUsage > 0 
      ? Math.round((currentStock / averageDailyUsage) * 10) / 10 
      : null;
      
    let suggestedReorder = 0;
    if (daysRemaining !== null && daysRemaining <= 5) {
      suggestedReorder = Math.max(0, Math.ceil((averageDailyUsage * 14) - currentStock));
    } else if (currentStock < lowStockThreshold) {
      suggestedReorder = Math.max(0, Math.ceil((lowStockThreshold * 2) - currentStock));
    }

    return {
      ingredient_id: row.ingredient_id,
      name: row.name,
      unit: row.unit,
      current_stock: currentStock,
      low_stock_threshold: lowStockThreshold,
      average_daily_usage: averageDailyUsage,
      days_remaining: daysRemaining,
      suggested_reorder: suggestedReorder
    };
  });

  return forecasts;
}

export async function discardStock(payload, actorUser, storeId) {
  const note = normalizeString(payload.note ?? payload.notes) || '';
  const operationId = requiredOperationId(payload.operationId ?? payload.operation_id);
  
  if (payload.productId || payload.product_id) {
    const productId = String(payload.productId ?? payload.product_id ?? '').trim();
    if (!productId) {
      throw new ApiError(400, 'Product ID is required.');
    }
    const quantity = Number(payload.quantity);
    if (Number.isNaN(quantity) || quantity <= 0) {
      throw new ApiError(400, 'Discard quantity must be a positive number.');
    }
    
    // 1. Get product detail to check if it exists and fetch name
    const productResult = await query('select name from products where id = $1 and store_id = $2 and deleted_at is null', [productId, storeId]);
    if (productResult.rowCount === 0) {
      throw new ApiError(404, 'Product not found.');
    }
    const productName = productResult.rows[0].name;

    // 2. Fetch the recipe of this product
    const recipeResult = await query('select id from recipes where product_id = $1 and store_id = $2 and deleted_at is null', [productId, storeId]);
    if (recipeResult.rowCount === 0) {
      throw new ApiError(400, `Sản phẩm "${productName}" chưa được thiết lập công thức định lượng.`);
    }
    const recipeId = recipeResult.rows[0].id;
    const itemsResult = await query('select ingredient_id, quantity_required from recipe_items where recipe_id = $1', [recipeId]);
    if (itemsResult.rowCount === 0) {
      throw new ApiError(400, `Công thức của "${productName}" chưa có thành phần nguyên liệu nào.`);
    }

    // 3. Batch apply stock changes for all recipe ingredients
    const client = await pool.connect();
    try {
      await client.query('begin');
      for (const row of itemsResult.rows) {
        const ingredientId = row.ingredient_id;
        const reqQty = Number(row.quantity_required);
        const totalQtyToDeduct = reqQty * quantity;

        const ingredientResult = await client.query('select name, current_stock from ingredients where id = $1 and store_id = $2 and deleted_at is null for update', [ingredientId, storeId]);
        if (ingredientResult.rowCount === 0) {
          throw new ApiError(404, `Ingredient ID ${ingredientId} not found.`);
        }
        const ingredient = ingredientResult.rows[0];
        const beforeStock = Number(ingredient.current_stock || 0);
        const afterStock = beforeStock - totalQtyToDeduct;

        if (afterStock < 0) {
          throw new ApiError(400, `Không đủ tồn kho cho nguyên liệu "${ingredient.name}". Cần ${totalQtyToDeduct}, hiện có ${beforeStock}.`);
        }

        await postLegacyIngredientChanges(client, { storeId, actorId: actorUser.id, operationKey: `legacy:${operationId}:product:${ingredientId}`,
          changes: [{ ingredientId, quantityDelta: -totalQtyToDeduct, movementType: 'WASTE_OUT', operation: 'PRODUCT_DISCARD_LEGACY' }] });
        await client.query(
          `insert into stock_transactions (ingredient_id, type, quantity, before_stock, after_stock, note, created_by, store_id)
           values ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            ingredientId,
            STOCK_TRANSACTION_TYPES.ADJUST,
            totalQtyToDeduct,
            beforeStock,
            afterStock,
            `[HỦY HÀNG] Hủy thành phẩm "${productName}" x${quantity}: ${note}`.slice(0, 255),
            actorUser.id,
            storeId,
          ]
        );
      }
      await client.query('commit');
      return { success: true };
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  } else {
    // Discard single raw ingredient
    const ingredientId = normalizeIngredientId(payload.ingredientId ?? payload.ingredient_id);
    const quantity = Number(payload.quantity);
    if (Number.isNaN(quantity) || quantity <= 0) {
      throw new ApiError(400, 'Discard quantity must be a positive number.');
    }
    
    // Fetch ingredient details to put in the note
    const ingredientResult = await query('select name from ingredients where id = $1 and store_id = $2 and deleted_at is null', [ingredientId, storeId]);
    if (ingredientResult.rowCount === 0) {
      throw new ApiError(404, 'Ingredient not found.');
    }
    const ingredientName = ingredientResult.rows[0].name;

    return applyStockChange({
      actorUser,
      ingredientId,
      note: `[HỦY HÀNG] Hủy nguyên liệu "${ingredientName}": ${note}`.slice(0, 255),
      quantity,
      type: STOCK_TRANSACTION_TYPES.ADJUST,
      movementType: 'WASTE_OUT', operationId,
      storeId,
    });
  }
}

export async function producePreparation(payload, actorUser, storeId) {
  const ingredientId = normalizeIngredientId(payload.ingredientId ?? payload.ingredient_id);
  const quantityProduced = ensurePositiveNumber(payload.quantity, 'Quantity produced');
  const note = normalizeString(payload.note ?? payload.notes);
  const operationId = requiredOperationId(payload.operationId ?? payload.operation_id);

  const client = await pool.connect();
  try {
    await client.query('begin');

    // 1. Get the preparation ingredient
    const preparationResult = await client.query(
      `select id, name, unit, is_preparation, current_stock from ingredients where id = $1 and store_id = $2 and deleted_at is null for update`,
      [ingredientId, storeId]
    );
    if (preparationResult.rowCount === 0) {
      throw new ApiError(404, 'Preparation not found.');
    }
    const preparation = preparationResult.rows[0];
    if (!preparation.is_preparation) {
      throw new ApiError(400, `Ingredient "${preparation.name}" is not a preparation.`);
    }

    // 2. Get the recipe
    const recipeResult = await client.query(
      `select id, yield_amount from recipes where ingredient_id = $1 and store_id = $2 and deleted_at is null`,
      [ingredientId, storeId]
    );
    if (recipeResult.rowCount === 0) {
      throw new ApiError(400, `Preparation "${preparation.name}" does not have a recipe.`);
    }
    const recipe = recipeResult.rows[0];
    const yieldAmount = Number(recipe.yield_amount);

    const recipeItemsResult = await client.query(
      `select ingredient_id, quantity_required from recipe_items where recipe_id = $1`,
      [recipe.id]
    );
    if (recipeItemsResult.rowCount === 0) {
      throw new ApiError(400, `Recipe for "${preparation.name}" has no ingredients.`);
    }

    // 3. Calculate ratio and deduct raw ingredients
    const ratio = quantityProduced / yieldAmount;
    
    // Sort items to prevent deadlocks
    const rawIngredientIds = recipeItemsResult.rows.map(row => row.ingredient_id).sort();
    
    const rawIngredientsResult = await client.query(
      `select id, name, current_stock from ingredients where id = any($1::uuid[]) and store_id = $2 and deleted_at is null for update`,
      [rawIngredientIds, storeId]
    );
    const rawIngredientsMap = new Map(rawIngredientsResult.rows.map(row => [row.id, row]));

    for (const row of recipeItemsResult.rows) {
      const rawIngredient = rawIngredientsMap.get(row.ingredient_id);
      if (!rawIngredient) {
        throw new ApiError(404, `Raw ingredient ${row.ingredient_id} not found.`);
      }

      const requiredQty = Number(row.quantity_required) * ratio;
      const beforeStock = Number(rawIngredient.current_stock || 0);
      const afterStock = beforeStock - requiredQty;

      if (afterStock < 0) {
        throw new ApiError(400, `Không đủ tồn kho cho nguyên liệu "${rawIngredient.name}". Cần ${requiredQty.toFixed(2)}, hiện có ${beforeStock}.`);
      }

      await postLegacyIngredientChanges(client, { storeId, actorId: actorUser.id, operationKey: `legacy:${operationId}:input:${rawIngredient.id}`,
        changes: [{ ingredientId: rawIngredient.id, quantityDelta: -requiredQty, movementType: 'PRODUCTION_INPUT', operation: 'PREPARATION_PRODUCTION' }] });
      
      await insertStockTransaction(client, {
        ingredientId: rawIngredient.id,
        type: STOCK_TRANSACTION_TYPES.PRODUCE_DEDUCT,
        quantity: requiredQty,
        beforeStock,
        afterStock,
        note: `[SẢN XUẤT] Dùng để pha chế ${quantityProduced} ${preparation.unit} ${preparation.name}`.slice(0, 255),
        createdBy: actorUser.id,
      }, storeId);
    }

    // 4. Add stock to preparation
    const prepBeforeStock = Number(preparation.current_stock || 0);
    const prepAfterStock = prepBeforeStock + quantityProduced;
    
    await postLegacyIngredientChanges(client, { storeId, actorId: actorUser.id, operationKey: `legacy:${operationId}:output:${preparation.id}`,
      changes: [{ ingredientId: preparation.id, quantityDelta: quantityProduced, movementType: 'PRODUCTION_OUTPUT', operation: 'PREPARATION_PRODUCTION' }] });
    const updatedPrepRow = await getIngredientForUpdate(client, preparation.id, storeId);
    
    const prepTransactionRow = await insertStockTransaction(client, {
      ingredientId: preparation.id,
      type: STOCK_TRANSACTION_TYPES.PRODUCE_ADD,
      quantity: quantityProduced,
      beforeStock: prepBeforeStock,
      afterStock: prepAfterStock,
      note: `[SẢN XUẤT] Nhập kho mẻ mới. ${note}`.trim().slice(0, 255),
      createdBy: actorUser.id,
    }, storeId);

    await client.query('commit');

    return {
      ingredient: toPublicIngredient(updatedPrepRow),
      transaction: toPublicStockTransaction(prepTransactionRow),
    };
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}
