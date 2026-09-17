import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requireOwner, requireStoreContext } from '../../middlewares/role.middleware.js';
import * as attendanceController from './attendance.controller.js';

const router = Router();

router.use(requireAuth, requireStoreContext());

// Staff check-in / check-out
router.post('/check-in', attendanceController.checkIn);
router.post('/check-out', attendanceController.checkOut);
router.get('/today-status', attendanceController.getTodayStatus);

// Admin-only endpoints
router.get('/qr-token', requireOwner(), attendanceController.getTodayToken);
router.get('/logs', requireOwner(), attendanceController.getLogs);

export default router;
