import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requireStoreContext, requireStoreManager } from '../../middlewares/role.middleware.js';
import {
  getInventoryItem,
  getInventoryItems,
  getInventoryMovement,
  getInventoryMovements,
  getStorageLocations,
  getInventoryItemUnits,
  createInventoryUnit,
  patchInventoryUnit,
  createInventoryStorageLocation,
  patchInventoryStorageLocation,
  patchInventoryItemStorageLocation,
} from './inventory.controller.js';
import {
  cancelInventoryDocument, createInventoryDocument, getDocument, getDocumentEvents, getDocuments, updateInventoryDocument,
} from './inventory-document.controller.js';
import {
  approveGoodsReceiptDocument, createGoodsReceipt, getGoodsReceiptById, rejectGoodsReceiptDocument, submitGoodsReceiptDocument, updateGoodsReceipt,
} from './goods-receipt.controller.js';

const router = Router();

router.use(requireAuth, requireStoreContext());

router.get('/items', getInventoryItems);
router.get('/items/:id', getInventoryItem);
router.get('/movements', getInventoryMovements);
router.get('/movements/:id', getInventoryMovement);
router.get('/storage-locations', getStorageLocations);
router.post('/storage-locations', requireStoreManager(), createInventoryStorageLocation);
router.patch('/storage-locations/:id', requireStoreManager(), patchInventoryStorageLocation);
router.get('/items/:id/units', getInventoryItemUnits);
router.post('/items/:id/units', requireStoreManager(), createInventoryUnit);
router.patch('/items/:id/units/:unitId', requireStoreManager(), patchInventoryUnit);
router.patch('/items/:id/storage-location', requireStoreManager(), patchInventoryItemStorageLocation);
// Phase 6A.1: raw-ingredient receipt draft and review workflow only. There is deliberately no approve route.
router.post('/goods-receipts', createGoodsReceipt);
router.get('/goods-receipts/:id', getGoodsReceiptById);
router.patch('/goods-receipts/:id', updateGoodsReceipt);
router.post('/goods-receipts/:id/submit', submitGoodsReceiptDocument);
router.post('/goods-receipts/:id/reject', rejectGoodsReceiptDocument);
router.post('/goods-receipts/:id/approve', requireStoreManager(), approveGoodsReceiptDocument);
router.get('/documents', getDocuments);
router.get('/documents/:id', getDocument);
router.get('/documents/:id/events', getDocumentEvents);
router.post('/documents', createInventoryDocument);
router.patch('/documents/:id', updateInventoryDocument);
router.post('/documents/:id/cancel', cancelInventoryDocument);

export default router;
