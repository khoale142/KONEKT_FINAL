import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requireOwner } from '../../middlewares/role.middleware.js';
import { getBestSellingProducts, getDiscardReport, getLowStockIngredients, getRevenueReport } from './report.controller.js';

const router = Router();

router.use(requireAuth, requireOwner());

router.get('/revenue', getRevenueReport);
router.get('/best-selling', getBestSellingProducts);
router.get('/low-stock', getLowStockIngredients);
router.get('/discards', getDiscardReport);

export default router;
