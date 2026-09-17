import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requireOwner, requireStoreContext } from '../../middlewares/role.middleware.js';
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
router.post('/:id/refund', requireOwner(), refundItems);

router.get('/', requireOwner(), getAllOrders);
router.get('/:id', requireOwner(), getOrderById);

export default router;
