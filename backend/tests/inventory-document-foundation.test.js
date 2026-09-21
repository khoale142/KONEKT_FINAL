import { describe, expect, it } from 'vitest';
import { allocateDocumentNumber, getDocumentPrefix } from '../src/modules/inventory/inventory-document-number.service.js';
import {
  getSubmissionSnapshotExtension,
  registerDocumentValidator,
  registerSubmissionSnapshotExtension,
  validateDocumentForSubmission,
} from '../src/modules/inventory/inventory-document-validation.service.js';
import { approveDocumentWithPosting, rejectDocument } from '../src/modules/inventory/inventory-document.service.js';

describe('Inventory document foundation helpers', () => {
  it('uses centralized prefixes and atomic sequence-row allocation', async () => {
    expect(getDocumentPrefix('GOODS_RECEIPT')).toBe('PN');
    expect(getDocumentPrefix('STOCK_COUNT')).toBe('KK');
    expect(getDocumentPrefix('INVENTORY_ADJUSTMENT')).toBe('DC');
    expect(getDocumentPrefix('WASTE_LOSS')).toBe('HH');
    expect(getDocumentPrefix('PREPARATION_PRODUCTION')).toBe('SX-BTP');
    expect(getDocumentPrefix('PRODUCT_PRODUCTION')).toBe('SX-SP');
    expect(getDocumentPrefix('STORE_TRANSFER')).toBe('CK');
    expect(getDocumentPrefix('REVERSAL')).toBe('RV');
    const client = { query: async () => ({ rows: [{ allocated_number: 17 }] }) };
    await expect(allocateDocumentNumber(client, 'store-1', 'GOODS_RECEIPT')).resolves.toBe('PN-000017');
  });

  it('includes a registered typed contribution and rejects unregistered submission types', async () => {
    const document = { document_type: 'GOODS_RECEIPT' };
    registerSubmissionSnapshotExtension('GOODS_RECEIPT', async () => ({ purchaseUnit: 'CASE', conversion: 24 }));
    await expect(getSubmissionSnapshotExtension(document, [], {})).resolves.toEqual({ purchaseUnit: 'CASE', conversion: 24 });
    await expect(getSubmissionSnapshotExtension({ document_type: 'STOCK_COUNT' }, [], {})).resolves.toBeNull();
    await expect(validateDocumentForSubmission(document, [], {})).rejects.toThrow('DOCUMENT_TYPE_NOT_OPERATIONAL');
    registerDocumentValidator('GOODS_RECEIPT', async () => undefined);
    await expect(validateDocumentForSubmission(document, [], {})).resolves.toBeUndefined();
  });

  it('never permits approval without a posting handler and blocks staff rejection before database access', async () => {
    await expect(approveDocumentWithPosting({ documentId: 'doc', actor: { id: 'actor' }, workspace: { role: 'MANAGER' } })).rejects.toThrow('DOCUMENT_TYPE_NOT_OPERATIONAL');
    await expect(rejectDocument('doc', { id: 'staff' }, { role: 'STAFF', storeId: 'store' }, 'reason')).rejects.toThrow('Manager or Owner role is required.');
  });
});
