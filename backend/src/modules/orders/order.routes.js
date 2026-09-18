import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requireStoreManager, requireStoreContext } from '../../middlewares/role.middleware.js';
import {
  createNewOrder,
  getAllOrders,
  getMyOrderById,
  getMyOrders,
  getOrderById,
  refundItems,
} from './order.controller.js';

const router = Router();
router.use(requireAuth, requireStoreContext());

router.post('/', createNewOrder);
router.get('/my-orders', getMyOrders);
router.get('/my-orders/:id', getMyOrderById);
router.post('/:id/refund', requireStoreManager(), refundItems);

router.get('/', requireStoreManager(), getAllOrders);
router.get('/:id', requireStoreManager(), getOrderById);

export default router;
