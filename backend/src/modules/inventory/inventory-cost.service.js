import { ApiError } from '../../utils/ApiError.js';
import { addDecimal, compareDecimal, decimal, divideDecimal, multiplyDecimal, requireNonNegativeDecimal, requirePositiveDecimal } from './inventory-decimal.js';
import { convertToBase } from './inventory-unit-conversion.service.js';

function unavailable(reason, details = {}) { return { available: false, status: 'UNAVAILABLE', reason, ...details }; }

export function calculateMovingWeightedAverage({ quantityOnHand, inventoryValue, currentUnitCost, receiptBaseQuantity, receiptTotalValue }) {
  const oldQuantity = decimal(quantityOnHand, 'Existing quantity');
  const incomingQuantity = requirePositiveDecimal(receiptBaseQuantity, 'Receipt base quantity');
  const incomingValue = requireNonNegativeDecimal(receiptTotalValue, 'Receipt total value');
  if (compareDecimal(oldQuantity, '0') < 0) return unavailable('NEGATIVE_QUANTITY_REQUIRES_POLICY', { existingQuantity: oldQuantity });
  if (compareDecimal(oldQuantity, '0') > 0 && (inventoryValue === null || inventoryValue === undefined || currentUnitCost === null || currentUnitCost === undefined)) {
    return unavailable('UNKNOWN_EXISTING_VALUE_REQUIRES_RECONCILIATION', { existingQuantity: oldQuantity });
  }
  const oldValue = compareDecimal(oldQuantity, '0') === 0 ? '0' : requireNonNegativeDecimal(inventoryValue, 'Existing inventory value');
  const newQuantity = addDecimal(oldQuantity, incomingQuantity);
  const newValue = addDecimal(oldValue, incomingValue);
  return {
    available: true, status: 'AVAILABLE',
    existingQuantity: oldQuantity, incomingBaseQuantity: incomingQuantity, incomingValue,
    incomingUnitCost: divideDecimal(incomingValue, incomingQuantity),
    projectedQuantity: newQuantity, projectedInventoryValue: newValue,
    projectedCurrentUnitCost: divideDecimal(newValue, newQuantity),
  };
}

export function calculateProductionCost({ attemptedQuantity, acceptedQuantity, failedQuantity, inputCost }) {
  const attempted = requirePositiveDecimal(attemptedQuantity, 'Attempted quantity');
  const accepted = requireNonNegativeDecimal(acceptedQuantity, 'Accepted quantity');
  const failed = requireNonNegativeDecimal(failedQuantity, 'Failed quantity');
  const totalInputCost = requireNonNegativeDecimal(inputCost, 'Input cost');
  if (addDecimal(accepted, failed) !== attempted) throw new ApiError(400, 'Accepted quantity plus failed quantity must equal attempted quantity.');
  const standardUnitCost = divideDecimal(totalInputCost, attempted);
  return { attemptedQuantity: attempted, acceptedQuantity: accepted, failedQuantity: failed, inputCost: totalInputCost, standardUnitCost, acceptedValue: multiplyDecimal(accepted, standardUnitCost), productionLossValue: multiplyDecimal(failed, standardUnitCost) };
}

export async function previewGoodsReceipt({ inventoryItem, purchaseUnitId, quantity, totalPurchaseValue, storeId, client }) {
  if (!inventoryItem?.id) throw new ApiError(400, 'Inventory item is required.');
  const conversion = await convertToBase({ inventoryItemId: inventoryItem.id, unitId: purchaseUnitId, quantity, storeId, client });
  const projection = calculateMovingWeightedAverage({ quantityOnHand: inventoryItem.quantity_on_hand, inventoryValue: inventoryItem.inventory_value, currentUnitCost: inventoryItem.current_unit_cost, receiptBaseQuantity: conversion.baseQuantity, receiptTotalValue: totalPurchaseValue });
  return { ...conversion, totalPurchaseValue: requireNonNegativeDecimal(totalPurchaseValue, 'Total purchase value'), currentQuantity: String(inventoryItem.quantity_on_hand), currentUnitCost: inventoryItem.current_unit_cost === null ? null : String(inventoryItem.current_unit_cost), projection, warnings: projection.available ? [] : [projection.reason] };
}
