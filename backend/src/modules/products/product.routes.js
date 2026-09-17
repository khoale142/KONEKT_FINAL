import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requireOwner, requireStoreContext } from '../../middlewares/role.middleware.js';
import {
  createNewProduct,
  deleteExistingProduct,
  getPosAvailableProducts,
  getProduct,
  getProducts,
  updateExistingProduct,
} from './product.controller.js';

const router = Router();

router.use(requireAuth, requireStoreContext());

router.get('/pos/available', getPosAvailableProducts);
router.get('/', getProducts);
router.get('/:id', getProduct);

router.post('/', requireOwner(), createNewProduct);
router.patch('/:id', requireOwner(), updateExistingProduct);
router.delete('/:id', requireOwner(), deleteExistingProduct);

export default router;
