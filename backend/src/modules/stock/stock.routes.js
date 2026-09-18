import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requireStoreManager, requireStoreContext } from '../../middlewares/role.middleware.js';
import {
  discardStockItem,
  getStockForecastList,
  getStockTransactions,
  performBatchStockImport,
  performDailyStockCount,
  performStockAdjustment,
  performStockImport,
} from './stock.controller.js';

const router = Router();


router.use(requireAuth, requireStoreContext());

router.get('/transactions', getStockTransactions);
router.get('/forecast', getStockForecastList);

router.post('/import', requireStoreManager(), performStockImport);
router.post('/import-batch', requireStoreManager(), performBatchStockImport);
router.post('/adjust', requireStoreManager(), performStockAdjustment);
router.post('/count', requireStoreManager(), performDailyStockCount);
router.post('/discard', requireStoreManager(), discardStockItem);

export default router;
