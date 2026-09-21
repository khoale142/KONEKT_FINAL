import { describe, expect, it } from 'vitest';
import { buildSubmittedDocumentSnapshot, hashDocumentSubmissionSnapshot } from '../src/modules/inventory/inventory-document.service.js';

const document = { document_number: 'PN-000001', document_type: 'GOODS_RECEIPT', revision: 2, note: null, effective_at: '2026-09-21T08:00:00.000Z' };
const typedPayload = { receiptLines: [{ documentItemId: 'line-a', inventoryItemId: 'item-a', enteredQuantity: '2.50', purchaseUnitId: 'unit-box', purchaseUnitName: 'Box', factorToBase: '12', conversionPath: [{ name: 'Each', factorToBase: '1', id: 'unit-each' }, { id: 'unit-box', factorToBase: '12', name: 'Box' }], convertedBaseQuantity: '30', purchaseValue: '100', incomingUnitCost: '3.333333333333', note: null }] };
const receiptLine = { document_item_id: 'line-a', line_number: 1, inventory_item_id: 'item-a', item_role: 'PRIMARY', base_quantity: '30.000', item_name_snapshot: 'Coffee', base_unit_snapshot: 'Each', storage_location_name_snapshot: 'Raw', note: null };
const genericLine = { id: 'line-a', line_number: 1, inventory_item_id: 'item-a', item_role: 'PRIMARY', base_quantity: '30', item_name_snapshot: 'Coffee', base_unit_snapshot: 'Each', storage_location_name_snapshot: 'Raw', note: null };
const snapshot = (lines, revision = 2, typed = typedPayload) => buildSubmittedDocumentSnapshot({ document, genericLines: lines, typedPayload: typed, revision });

describe('Goods Receipt shared submission hash', () => {
  it('builds byte-equivalent submit and approval snapshots from persisted receipt/generic shapes', () => expect(JSON.stringify(snapshot([receiptLine]))).toBe(JSON.stringify(snapshot([genericLine]))));
  it('produces the same SHA-256 hash for submit and approval reconstruction', () => expect(hashDocumentSubmissionSnapshot(snapshot([receiptLine]))).toBe(hashDocumentSubmissionSnapshot(snapshot([genericLine]))));
  it('normalizes converted base quantity identically in both paths', () => expect(snapshot([receiptLine]).genericLines[0].baseQuantity).toBe('30'));
  it('changes hash when frozen typed receipt content changes', () => expect(hashDocumentSubmissionSnapshot(snapshot([genericLine], 2, { ...typedPayload, receiptLines: [{ ...typedPayload.receiptLines[0], purchaseValue: '101' }] }))).not.toBe(hashDocumentSubmissionSnapshot(snapshot([genericLine]))));
  it('changes hash when frozen generic line content changes', () => expect(hashDocumentSubmissionSnapshot(snapshot([{ ...genericLine, note: 'changed' }]))).not.toBe(hashDocumentSubmissionSnapshot(snapshot([genericLine]))));
  it('does not include current unit configuration in the frozen reconstruction', () => { const first = hashDocumentSubmissionSnapshot(snapshot([genericLine])); const laterUnitConfig = { name: 'Renamed', factor: '99' }; expect(hashDocumentSubmissionSnapshot(snapshot([genericLine]))).toBe(first); expect(laterUnitConfig.name).toBe('Renamed'); });
  it('does not include current inventory balance or cost in the hash', () => { const first = hashDocumentSubmissionSnapshot(snapshot([{ ...genericLine, quantity_on_hand: '1', current_unit_cost: '2' }])); const later = hashDocumentSubmissionSnapshot(snapshot([{ ...genericLine, quantity_on_hand: '999', current_unit_cost: '888' }])); expect(later).toBe(first); });
  it('makes a resubmitted revision a distinct correctly reconstructable hash', () => { expect(hashDocumentSubmissionSnapshot(snapshot([genericLine], 3))).not.toBe(hashDocumentSubmissionSnapshot(snapshot([genericLine], 2))); expect(hashDocumentSubmissionSnapshot(snapshot([receiptLine], 3))).toBe(hashDocumentSubmissionSnapshot(snapshot([genericLine], 3))); });
  it('sorts lines and object keys deterministically', () => { const second = { ...genericLine, id: 'line-b', line_number: 2, inventory_item_id: 'item-b' }; expect(hashDocumentSubmissionSnapshot(snapshot([second, genericLine]))).toBe(hashDocumentSubmissionSnapshot(snapshot([genericLine, second]))); });
});
