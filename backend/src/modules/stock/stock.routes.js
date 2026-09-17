import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requireOwner, requireStoreContext } from '../../middlewares/role.middleware.js';
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

router.post('/import', requireOwner(), performStockImport);
router.post('/import-batch', requireOwner(), performBatchStockImport);
router.post('/adjust', requireOwner(), performStockAdjustment);
router.post('/count', requireOwner(), performDailyStockCount);
router.post('/discard', requireOwner(), discardStockItem);

export default router;
