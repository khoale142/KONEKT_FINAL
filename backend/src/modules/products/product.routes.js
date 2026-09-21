import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requireStoreManager, requireStoreContext } from '../../middlewares/role.middleware.js';
import {
  createNewProduct,
  deleteExistingProduct,
  getPosAvailableProducts,
  getProduct,
  getProducts,
  updateExistingProduct,
  bulkCreateProducts,
  addNewProductSize,
  updateExistingProductSize,
  reorderExistingProductSizes,
  archiveExistingProductSize,
  assignProductCategories,
} from './product.controller.js';

const router = Router();

router.use(requireAuth, requireStoreContext());

router.get('/pos/available', getPosAvailableProducts);
router.get('/', getProducts);
router.get('/:id', getProduct);

router.post('/bulk', requireStoreManager(), bulkCreateProducts);
router.patch('/categories', requireStoreManager(), assignProductCategories);
router.post('/', requireStoreManager(), createNewProduct);
router.post('/:id/sizes', requireStoreManager(), addNewProductSize);
router.patch('/:id/sizes/reorder', requireStoreManager(), reorderExistingProductSizes);
router.patch('/:id/sizes/:sizeId', requireStoreManager(), updateExistingProductSize);
router.delete('/:id/sizes/:sizeId', requireStoreManager(), archiveExistingProductSize);
router.patch('/:id', requireStoreManager(), updateExistingProduct);
router.delete('/:id', requireStoreManager(), deleteExistingProduct);

export default router;
