import { describe, expect, it } from 'vitest';
import { buildGoodsReceiptSubmissionSnapshot, calculateGoodsReceiptApprovalValuation, calculateGoodsReceiptValuation, hashGoodsReceiptSubmissionSnapshot, parseGoodsReceiptApprovalControls } from '../src/modules/inventory/goods-receipt.service.js';

const document = { document_number: 'PN-000001', revision: 1, note: 'supplier invoice', effective_at: null };
const line = { document_item_id: 'document-line-a', inventory_item_id: 'inventory-a', entered_quantity: '2', entered_unit_id: 'unit-case', entered_unit_name_snapshot: 'Case', conversion_factor_to_base_snapshot: '12', conversion_path_snapshot: [{ id: 'unit-case', factorToBase: '12' }, { id: 'unit-each', factorToBase: '1' }], converted_base_quantity: '24', total_purchase_value: '120', derived_incoming_unit_cost: '5', note: 'fresh' };

describe('Goods Receipt 6A.1 pure contracts', () => {
  it('calculates an exact multi-level conversion valuation result', () => {
    expect(calculateGoodsReceiptValuation({ existingQuantity: '6', inventoryValue: '18', currentUnitCost: '3', baseQuantity: '24', purchaseValue: '120' })).toMatchObject({ incomingUnitCost: '5', resultingQuantity: '30', resultingInventoryValue: '138', resultingUnitCost: '4.6' });
  });
  it('requires bootstrap valuation when existing stock has no cost', () => {
    expect(() => calculateGoodsReceiptValuation({ existingQuantity: '6', inventoryValue: null, currentUnitCost: null, baseQuantity: '24', purchaseValue: '120' })).toThrow('Initial inventory valuation confirmation is required.');
  });
  it('includes every approval-relevant typed value in a deterministic payload', () => {
    const first = buildGoodsReceiptSubmissionSnapshot(document, [line]);
    expect(first.receiptLines[0]).toMatchObject({ documentItemId: 'document-line-a', inventoryItemId: 'inventory-a', factorToBase: '12', convertedBaseQuantity: '24', purchaseValue: '120', incomingUnitCost: '5', note: 'fresh' });
    expect(JSON.stringify(buildGoodsReceiptSubmissionSnapshot(document, [{ ...line, total_purchase_value: '121' }]))).not.toBe(JSON.stringify(first));
    expect(JSON.stringify(buildGoodsReceiptSubmissionSnapshot(document, [{ ...line, conversion_factor_to_base_snapshot: '6' }]))).not.toBe(JSON.stringify(first));
  });
  it('does not include mutable inventory quantity or current cost in receipt payload', () => {
    const snapshot = JSON.stringify(buildGoodsReceiptSubmissionSnapshot(document, [{ ...line, quantity_on_hand: '999', current_unit_cost: '42' }]));
    expect(snapshot).not.toContain('999'); expect(snapshot).not.toContain('42');
  });
  it('changes the SHA-256 submission hash for each approval-relevant receipt edit', () => {
    const original = hashGoodsReceiptSubmissionSnapshot(document, [line]);
    expect(hashGoodsReceiptSubmissionSnapshot(document, [{ ...line, entered_quantity: '3' }])).not.toBe(original);
    expect(hashGoodsReceiptSubmissionSnapshot(document, [{ ...line, entered_unit_id: 'unit-each' }])).not.toBe(original);
    expect(hashGoodsReceiptSubmissionSnapshot(document, [{ ...line, conversion_path_snapshot: [{ id: 'unit-each', factorToBase: '1' }] }])).not.toBe(original);
    expect(hashGoodsReceiptSubmissionSnapshot(document, [{ ...line, note: 'changed' }])).not.toBe(original);
  });
  it('calculates normal approval-time WAC from locked current values', () => {
    const result = calculateGoodsReceiptApprovalValuation({ quantity_on_hand: '2', inventory_value: '20', current_unit_cost: '10', cost_status: 'AVAILABLE' }, { ...line });
    expect(result).toMatchObject({ resultingQuantity: '26', resultingInventoryValue: '140', resultingUnitCost: '5.384615384615', initialValuationApplied: false, totalValuationDelta: '120' });
  });
  it('treats the first zero-value receipt as known zero cost', () => {
    const result = calculateGoodsReceiptApprovalValuation({ quantity_on_hand: '0', inventory_value: null, current_unit_cost: null, cost_status: 'UNAVAILABLE' }, { ...line, total_purchase_value: '0', derived_incoming_unit_cost: '0' });
    expect(result).toMatchObject({ resultingQuantity: '24', resultingInventoryValue: '0', resultingUnitCost: '0', initialValuationApplied: false });
  });
  it('requires confirmation for positive stock with unavailable valuation and bootstraps only when confirmed', () => {
    const item = { quantity_on_hand: '20', inventory_value: null, current_unit_cost: null, cost_status: 'UNAVAILABLE' };
    expect(() => calculateGoodsReceiptApprovalValuation(item, line)).toThrow('Initial inventory valuation confirmation is required.');
    expect(calculateGoodsReceiptApprovalValuation(item, line, true)).toMatchObject({ initialValuationApplied: true, initialExistingQuantity: '20', initialValuationValue: '100', totalValuationDelta: '220', resultingQuantity: '44', resultingInventoryValue: '220', resultingUnitCost: '5' });
  });
  it('accepts only approval-time initial valuation line controls', () => {
    expect([...parseGoodsReceiptApprovalControls({ initialValuationLineIds: ['line-a', 'line-a'] })]).toEqual(['line-a']);
    expect(() => parseGoodsReceiptApprovalControls({ totalPurchaseValue: '99' })).toThrow('Submitted receipt values cannot be edited during approval.');
  });
});
