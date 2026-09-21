import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requireStoreContext, requireStoreManager } from '../../middlewares/role.middleware.js';
import { getBestSellingProducts, getDiscardReport, getLowStockIngredients, getRevenueReport } from './report.controller.js';

const router = Router();

router.use(requireAuth, requireStoreContext(), requireStoreManager());

router.get('/revenue', getRevenueReport);
router.get('/best-selling', getBestSellingProducts);
router.get('/best-selling-products', getBestSellingProducts);
router.get('/low-stock', getLowStockIngredients);
router.get('/low-stock-ingredients', getLowStockIngredients);
router.get('/discards', getDiscardReport);

export default router;
