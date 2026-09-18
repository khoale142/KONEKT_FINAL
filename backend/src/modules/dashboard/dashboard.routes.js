import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requireStoreContext, requireStoreManager } from '../../middlewares/role.middleware.js';
import { getDashboardSummary } from './dashboard.controller.js';

const router = Router();

router.use(requireAuth, requireStoreContext());

router.get('/summary', requireStoreManager(), getDashboardSummary);

export default router;
