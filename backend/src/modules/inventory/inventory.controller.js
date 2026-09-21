import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import {
  getInventoryItemById,
  listInventoryItems,
  listStorageLocations,
  listInventoryItemUnits,
  createInventoryItemUnit,
  updateInventoryItemUnit,
  createStorageLocation,
  updateStorageLocation,
  assignInventoryItemStorageLocation,
} from './inventory.service.js';
import {
  getInventoryMovementById,
  listInventoryMovements,
} from './inventory-movement.repository.js';

function toNumber(value) {
  return value === null || value === undefined ? null : Number(value);
}

function toMovementDto(row) {
  return {
    id: row.id,
    item: {
      id: row.inventory_item_id,
      displayName: row.item_name,
      type: row.item_type,
      unit: row.unit_name ? { name: row.unit_name, symbol: row.unit_symbol } : null,
    },
    movementType: row.movement_type,
    quantityDelta: toNumber(row.quantity_delta),
    beforeQuantity: toNumber(row.before_quantity),
    afterQuantity: toNumber(row.after_quantity),
    unitCostSnapshot: toNumber(row.unit_cost_snapshot),
    valueDelta: toNumber(row.value_delta),
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
    actorDisplayName: row.actor_name || null,
  };
}

export const getInventoryItems = asyncHandler(async (req, res) => {
  const items = await listInventoryItems(req.query, req.workspace.storeId);
  return sendSuccess(res, {
    message: 'Inventory foundation items loaded successfully.',
    data: { items },
  });
});

export const getInventoryItem = asyncHandler(async (req, res) => {
  const item = await getInventoryItemById(req.params.id, req.workspace.storeId);
  return sendSuccess(res, {
    message: 'Inventory foundation item loaded successfully.',
    data: { item },
  });
});

export const getStorageLocations = asyncHandler(async (req, res) => {
  const storageLocations = await listStorageLocations(req.query, req.workspace.storeId);
  return sendSuccess(res, {
    message: 'Inventory storage locations loaded successfully.',
    data: { storageLocations },
  });
});

export const getInventoryItemUnits = asyncHandler(async (req, res) => sendSuccess(res, {
  message: 'Inventory item units loaded successfully.',
  data: { units: await listInventoryItemUnits(req.params.id, req.workspace.storeId, req.query.includeInactive === 'true') },
}));

export const createInventoryUnit = asyncHandler(async (req, res) => sendSuccess(res, {
  message: 'Inventory purchase unit created successfully.', statusCode: 201,
  data: { unit: await createInventoryItemUnit(req.params.id, req.body, req.workspace.storeId) },
}));

export const patchInventoryUnit = asyncHandler(async (req, res) => sendSuccess(res, {
  message: 'Inventory unit updated successfully.',
  data: { unit: await updateInventoryItemUnit(req.params.id, req.params.unitId, req.body, req.workspace.storeId) },
}));

export const createInventoryStorageLocation = asyncHandler(async (req, res) => sendSuccess(res, {
  message: 'Storage location created successfully.', statusCode: 201,
  data: { storageLocation: await createStorageLocation(req.body, req.user.id, req.workspace.storeId) },
}));

export const patchInventoryStorageLocation = asyncHandler(async (req, res) => sendSuccess(res, {
  message: 'Storage location updated successfully.',
  data: { storageLocation: await updateStorageLocation(req.params.id, req.body, req.workspace.storeId) },
}));

export const patchInventoryItemStorageLocation = asyncHandler(async (req, res) => sendSuccess(res, {
  message: 'Inventory item storage location updated successfully.',
  data: { item: await assignInventoryItemStorageLocation(req.params.id, req.body.storageLocationId ?? req.body.storage_location_id ?? null, req.workspace.storeId) },
}));

export const getInventoryMovements = asyncHandler(async (req, res) => {
  const movements = await listInventoryMovements(req.query, req.workspace.storeId);
  return sendSuccess(res, {
    message: 'Inventory movements loaded successfully.',
    data: { movements: movements.map(toMovementDto) },
  });
});

export const getInventoryMovement = asyncHandler(async (req, res) => {
  const movement = await getInventoryMovementById(req.params.id, req.workspace.storeId);
  if (!movement) {
    throw new ApiError(404, 'Inventory movement not found.');
  }
  return sendSuccess(res, {
    message: 'Inventory movement loaded successfully.',
    data: { movement: toMovementDto(movement) },
  });
});
