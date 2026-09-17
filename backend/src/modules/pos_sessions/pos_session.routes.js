import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requireOwner, requireStoreContext } from '../../middlewares/role.middleware.js';
import {
  getOpenSession,
  getSessionsHistoryForOwner,
  getSessionsHistoryForStaff,
  getSingleSessionReportForOwner,
  getSingleSessionReportForStaff,
  postCloseSession,
  postMidShiftCount,
  postOpenSession,
} from './pos_session.controller.js';

const router = Router();

router.use(requireAuth, requireStoreContext());

// Staff endpoints
router.get('/active', getOpenSession);
router.post('/open', postOpenSession);
router.post('/close', postCloseSession);
router.post('/mid-shift-count', postMidShiftCount);
router.get('/my-history', getSessionsHistoryForStaff);
router.get('/my-reports/:id', getSingleSessionReportForStaff);

// Owner endpoints
router.get('/history', requireOwner(), getSessionsHistoryForOwner);
router.get('/reports/:id', requireOwner(), getSingleSessionReportForOwner);

export default router;
