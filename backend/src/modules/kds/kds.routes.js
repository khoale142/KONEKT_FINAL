import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requireStoreContext } from '../../middlewares/role.middleware.js';
import { getKdsOrders, markOrderAsCompleted } from './kds.controller.js';

const router = Router();

router.use(requireAuth, requireStoreContext());

router.get('/', getKdsOrders);
router.post('/:id/complete', markOrderAsCompleted);

export default router;
