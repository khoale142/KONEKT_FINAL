import { pool } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import {
  findMovementsByPostingKeys,
  lockInventoryItems,
} from './inventory-movement.repository.js';
import { mirrorIngredientQuantityFromInventory } from './inventory-compatibility-mirror.service.js';

const MOVEMENT_TYPES = new Set([
  'RECEIPT_IN', 'SALE_OUT', 'REFUND_IN', 'COUNT_ADJUST', 'MANUAL_ADJUST',
  'WASTE_OUT', 'PRODUCTION_INPUT', 'PRODUCTION_OUTPUT', 'TRANSFER_OUT',
  'TRANSFER_IN', 'REVERSAL',
]);
const COST_STATUSES = new Set(['UNAVAILABLE', 'AVAILABLE', 'STALE']);
const DECIMAL_PATTERN = /^-?(?:\d+|\d*\.\d+)$/;

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function requiredString(value, fieldName) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) throw new ApiError(400, `${fieldName} is required.`);
  return normalized;
}

function optionalString(value, fieldName) {
  if (value === undefined || value === null || value === '') return null;
  return requiredString(value, fieldName);
}

function numericString(value, fieldName, { required = false, nonZero = false, nonNegative = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new ApiError(400, `${fieldName} is required.`);
    return null;
  }
  const normalized = typeof value === 'number' ? String(value) : String(value).trim();
  if (!DECIMAL_PATTERN.test(normalized) || !Number.isFinite(Number(normalized))) {
    throw new ApiError(400, `${fieldName} must be a finite decimal number.`);
  }
  const numericValue = Number(normalized);
  if (nonZero && numericValue === 0) throw new ApiError(400, `${fieldName} cannot be zero.`);
  if (nonNegative && numericValue < 0) throw new ApiError(400, `${fieldName} cannot be negative.`);
  return normalized;
}

function normalizeOccurredAt(value) {
  if (value === undefined || value === null || value === '') return new Date().toISOString();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new ApiError(400, 'occurredAt is invalid.');
  return date.toISOString();
}

function normalizeMetadata(value, postingGroupKey) {
  if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) {
    throw new ApiError(400, 'metadata must be an object.');
  }
  const metadata = { ...(value || {}) };
  if (postingGroupKey) metadata.postingGroupKey = postingGroupKey;
  try {
    return JSON.stringify(metadata);
  } catch {
    throw new ApiError(400, 'metadata must be JSON serializable.');
  }
}

function normalizeBalanceMutation(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(400, 'balanceMutation must be an object.');
  }

  const hasInventoryValueDelta = hasOwn(value, 'inventoryValueDelta');
  const hasResultingInventoryValue = hasOwn(value, 'resultingInventoryValue');
  if (hasInventoryValueDelta && hasResultingInventoryValue) {
    throw new ApiError(400, 'balanceMutation cannot contain both inventoryValueDelta and resultingInventoryValue.');
  }

  const hasResultingUnitCost = hasOwn(value, 'resultingUnitCost');
  const hasResultingCostStatus = hasOwn(value, 'resultingCostStatus');
  const resultingCostStatus = hasResultingCostStatus
    ? requiredString(value.resultingCostStatus, 'resultingCostStatus').toUpperCase()
    : null;
  if (resultingCostStatus && !COST_STATUSES.has(resultingCostStatus)) {
    throw new ApiError(400, 'resultingCostStatus is invalid.');
  }

  return {
    hasInventoryValueDelta,
    inventoryValueDelta: hasInventoryValueDelta
      ? numericString(value.inventoryValueDelta, 'inventoryValueDelta', { required: true })
      : null,
    hasResultingInventoryValue,
    resultingInventoryValue: hasResultingInventoryValue && value.resultingInventoryValue !== null
      ? numericString(value.resultingInventoryValue, 'resultingInventoryValue', { required: true })
      : null,
    hasResultingUnitCost,
    resultingUnitCost: hasResultingUnitCost && value.resultingUnitCost !== null
      ? numericString(value.resultingUnitCost, 'resultingUnitCost', { required: true, nonNegative: true })
      : null,
    hasResultingCostStatus,
    resultingCostStatus,
  };
}

function normalizeMovement(input, postingGroupKey, occurredAt) {
  const movementType = requiredString(input.movementType, 'movementType').toUpperCase();
  if (!MOVEMENT_TYPES.has(movementType)) throw new ApiError(400, 'movementType is invalid.');
  const balanceMutation = normalizeBalanceMutation(input.balanceMutation);
  const valueDelta = numericString(input.valueDelta, 'valueDelta');

  if (
    valueDelta !== null
    && balanceMutation?.hasInventoryValueDelta
    && Number(valueDelta) !== Number(balanceMutation.inventoryValueDelta)
  ) {
    throw new ApiError(400, 'valueDelta must match balanceMutation.inventoryValueDelta when both are supplied.');
  }

  return {
    inventoryItemId: requiredString(input.inventoryItemId, 'inventoryItemId'),
    postingKey: requiredString(input.postingKey, 'postingKey'),
    movementType,
    quantityDelta: numericString(input.quantityDelta, 'quantityDelta', { required: true, nonZero: true }),
    unitCostSnapshot: numericString(input.unitCostSnapshot, 'unitCostSnapshot', { nonNegative: true }),
    valueDelta: valueDelta ?? balanceMutation?.inventoryValueDelta ?? null,
    documentId: optionalString(input.documentId, 'documentId'),
    documentItemId: optionalString(input.documentItemId, 'documentItemId'),
    orderId: optionalString(input.orderId, 'orderId'),
    orderItemId: optionalString(input.orderItemId, 'orderItemId'),
    reversalOfMovementId: optionalString(input.reversalOfMovementId, 'reversalOfMovementId'),
    occurredAt: normalizeOccurredAt(input.occurredAt ?? occurredAt),
    metadata: normalizeMetadata(input.metadata, postingGroupKey),
    balanceMutation,
  };
}

function normalizePostingInput(input) {
  if (!input || typeof input !== 'object') throw new ApiError(400, 'Posting input is required.');
  if (!Array.isArray(input.movements) || input.movements.length === 0) {
    throw new ApiError(400, 'At least one movement is required.');
  }
  const storeId = requiredString(input.storeId, 'storeId');
  const actorId = requiredString(input.actorId, 'actorId');
  const postingGroupKey = optionalString(input.postingGroupKey, 'postingGroupKey');
  const occurredAt = normalizeOccurredAt(input.occurredAt);
  const movements = input.movements.map((movement) => normalizeMovement(movement, postingGroupKey, occurredAt));
  const postingKeys = movements.map((movement) => movement.postingKey);
  if (new Set(postingKeys).size !== postingKeys.length) {
    throw new ApiError(400, 'postingKey values must be unique within one posting request.');
  }

  return {
    storeId,
    actorId,
    movements,
    postingKeys,
    allowNegative: input.allowNegative === true,
    // A document workflow may need to derive its value mutations from balances locked by this
    // service. The callback is internal-only; HTTP callers cannot serialize a function.
    prepareLockedMovements: typeof input.prepareLockedMovements === 'function' ? input.prepareLockedMovements : null,
  };
}

function idempotentResultIfComplete(existing, requestedMovements, storeId) {
  if (!existing.length) return null;
  if (existing.length !== requestedMovements.length) {
    throw new ApiError(409, 'A subset of posting keys already exists; the posting request is inconsistent.');
  }
  const requestedByKey = new Map(requestedMovements.map((movement) => [movement.postingKey, movement]));
  const mismatch = existing.some((movement) => {
    const requested = requestedByKey.get(movement.posting_key);
    return !requested
      || movement.store_id !== storeId
      || movement.inventory_item_id !== requested.inventoryItemId
      || movement.movement_type !== requested.movementType;
  });
  if (mismatch) {
    throw new ApiError(409, 'postingKey already belongs to a different Store, item, or movement type.');
  }
  return { alreadyPosted: true, movements: existing };
}

function validateLockedItem(item) {
  const isProduct = item.item_type === 'PRODUCT';
  const catalogReferenceIsValid = isProduct
    ? item.product_id && !item.ingredient_id
    : item.ingredient_id && !item.product_id;
  if (!catalogReferenceIsValid) {
    throw new ApiError(409, 'Inventory item catalog integrity is invalid.');
  }
  if (isProduct && item.product_is_group && !item.product_parent_product_id) {
    throw new ApiError(409, 'Product group parents cannot be posted as inventory items.');
  }
}

async function validateReversalOrigins(client, storeId, movements) {
  const reversalIds = [...new Set(movements
    .map((movement) => movement.reversalOfMovementId)
    .filter(Boolean))];
  if (!reversalIds.length) return;
  const result = await client.query(`
    select id, store_id
    from inventory_movements
    where id = any($1::uuid[])
  `, [reversalIds]);
  if (result.rows.length !== reversalIds.length || result.rows.some((row) => row.store_id !== storeId)) {
    throw new ApiError(400, 'reversalOfMovementId must identify a movement in the same Store.');
  }
}

async function applyBalanceMutation(client, storeId, item, movement, allowNegative) {
  const mutation = movement.balanceMutation;
  if (mutation?.hasInventoryValueDelta && item.inventory_value === null) {
    throw new ApiError(409, 'inventoryValueDelta requires a known inventory value or an explicit resultingInventoryValue.');
  }

  const params = [movement.quantityDelta];
  const setClauses = [
    'quantity_on_hand = quantity_on_hand + $1::numeric',
    'row_version = row_version + 1',
    'updated_at = now()',
  ];
  const costChangedComparisons = [];

  if (mutation?.hasInventoryValueDelta) {
    params.push(mutation.inventoryValueDelta);
    const placeholder = `$${params.length}`;
    setClauses.push(`inventory_value = inventory_value + ${placeholder}::numeric`);
    costChangedComparisons.push(`inventory_value is distinct from inventory_value + ${placeholder}::numeric`);
  }
  if (mutation?.hasResultingInventoryValue) {
    params.push(mutation.resultingInventoryValue);
    const placeholder = `$${params.length}`;
    setClauses.push(`inventory_value = ${placeholder}::numeric`);
    costChangedComparisons.push(`inventory_value is distinct from ${placeholder}::numeric`);
  }
  if (mutation?.hasResultingUnitCost) {
    params.push(mutation.resultingUnitCost);
    const placeholder = `$${params.length}`;
    setClauses.push(`current_unit_cost = ${placeholder}::numeric`);
    costChangedComparisons.push(`current_unit_cost is distinct from ${placeholder}::numeric`);
  }
  if (mutation?.hasResultingCostStatus) {
    params.push(mutation.resultingCostStatus);
    const placeholder = `$${params.length}`;
    setClauses.push(`cost_status = ${placeholder}::inventory_cost_status`);
    costChangedComparisons.push(`cost_status is distinct from ${placeholder}::inventory_cost_status`);
  }
  if (costChangedComparisons.length) {
    setClauses.push(`cost_version = cost_version + case when ${costChangedComparisons.join(' or ')} then 1 else 0 end`);
  }

  params.push(item.id, storeId, allowNegative);
  const itemIdPlaceholder = `$${params.length - 2}`;
  const storeIdPlaceholder = `$${params.length - 1}`;
  const allowNegativePlaceholder = `$${params.length}`;
  const result = await client.query(`
    update inventory_items
    set ${setClauses.join(', ')}
    where id = ${itemIdPlaceholder}
      and store_id = ${storeIdPlaceholder}
      and (${allowNegativePlaceholder}::boolean or quantity_on_hand + $1::numeric >= 0)
    returning quantity_on_hand - $1::numeric as before_quantity,
              quantity_on_hand as after_quantity,
              inventory_value,
              current_unit_cost,
              cost_status,
              cost_version,
              row_version
  `, params);
  if (!result.rows[0]) {
    throw new ApiError(409, 'Posting would create a negative inventory balance.');
  }
  return result.rows[0];
}

async function insertMovement(client, storeId, actorId, movement, balance) {
  const result = await client.query(`
    insert into inventory_movements (
      store_id, inventory_item_id, document_id, document_item_id, order_id, order_item_id,
      movement_type, quantity_delta, before_quantity, after_quantity,
      unit_cost_snapshot, value_delta, reversal_of_movement_id,
      posting_key, posted_by, occurred_at, metadata
    ) values (
      $1, $2, $3, $4, $5, $6,
      $7::inventory_movement_type, $8::numeric, $9::numeric, $10::numeric,
      $11::numeric, $12::numeric, $13,
      $14, $15, $16::timestamptz, $17::jsonb
    )
    returning id, store_id, inventory_item_id, posting_key, movement_type,
              quantity_delta, before_quantity, after_quantity,
              unit_cost_snapshot, value_delta, occurred_at
  `, [
    storeId, movement.inventoryItemId, movement.documentId, movement.documentItemId,
    movement.orderId, movement.orderItemId, movement.movementType, movement.quantityDelta,
    balance.before_quantity, balance.after_quantity, movement.unitCostSnapshot, movement.valueDelta,
    movement.reversalOfMovementId, movement.postingKey, actorId, movement.occurredAt, movement.metadata,
  ]);
  return result.rows[0];
}

// This function intentionally requires the caller's transaction client. Future document and POS
// services can compose it inside their own transaction without any pool reads or hidden commits.
export async function postInventoryMovements(client, input) {
  if (!client?.query) throw new Error('InventoryPostingService requires a PostgreSQL transaction client.');
  const posting = normalizePostingInput(input);
  const existingBeforeLock = await findMovementsByPostingKeys(client, posting.postingKeys);
  const idempotentBeforeLock = idempotentResultIfComplete(existingBeforeLock, posting.movements, posting.storeId);
  if (idempotentBeforeLock) return idempotentBeforeLock;

  const lockedItems = await lockInventoryItems(
    client,
    posting.storeId,
    posting.movements.map((movement) => movement.inventoryItemId),
  );
  if (lockedItems.length !== new Set(posting.movements.map((movement) => movement.inventoryItemId)).size) {
    throw new ApiError(404, 'One or more inventory items do not exist in the supplied Store.');
  }
  lockedItems.forEach(validateLockedItem);

  // Recheck after deterministic locks so a retry serialized behind another posting returns
  // idempotently instead of applying a second balance mutation.
  const existingAfterLock = await findMovementsByPostingKeys(client, posting.postingKeys);
  const idempotentAfterLock = idempotentResultIfComplete(existingAfterLock, posting.movements, posting.storeId);
  if (idempotentAfterLock) return idempotentAfterLock;
  await validateReversalOrigins(client, posting.storeId, posting.movements);

  if (posting.prepareLockedMovements) {
    await posting.prepareLockedMovements({ client, storeId: posting.storeId, lockedItems, movements: posting.movements });
    // The hook runs only after deterministic row locks and may derive the exact resulting
    // valuation from those locked balances. Re-normalize the mutable financial fields before
    // the shared balance writer consumes them.
    for (const movement of posting.movements) {
      movement.balanceMutation = normalizeBalanceMutation(movement.balanceMutation);
      movement.valueDelta = numericString(movement.valueDelta, 'valueDelta');
      movement.unitCostSnapshot = numericString(movement.unitCostSnapshot, 'unitCostSnapshot', { nonNegative: true });
    }
  }

  const itemsById = new Map(lockedItems.map((item) => [item.id, item]));
  const inserted = [];
  for (const movement of posting.movements) {
    const item = itemsById.get(movement.inventoryItemId);
    const balance = await applyBalanceMutation(client, posting.storeId, item, movement, posting.allowNegative);
    await mirrorIngredientQuantityFromInventory(client, {
      storeId: posting.storeId,
      inventoryItem: item,
      resultingQuantity: balance.after_quantity,
    });
    const insertedMovement = await insertMovement(client, posting.storeId, posting.actorId, movement, balance);
    inserted.push(insertedMovement);
    itemsById.set(item.id, {
      ...item,
      quantity_on_hand: balance.after_quantity,
      inventory_value: balance.inventory_value,
      current_unit_cost: balance.current_unit_cost,
      cost_status: balance.cost_status,
      cost_version: balance.cost_version,
      row_version: balance.row_version,
    });
  }

  return { alreadyPosted: false, movements: inserted };
}

// Convenience boundary for future callers that do not already own a transaction. No existing
// runtime service calls this in Phase 2.
export async function postInventoryMovementsAtomically(input) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await postInventoryMovements(client, input);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    if (error?.constraint === 'uq_inventory_movements_posting_key') {
      const requested = normalizePostingInput(input);
      const existing = await findMovementsByPostingKeys(client, requested.postingKeys);
      const idempotent = idempotentResultIfComplete(existing, requested.movements, requested.storeId);
      if (idempotent) return idempotent;
    }
    throw error;
  } finally {
    client.release();
  }
}
