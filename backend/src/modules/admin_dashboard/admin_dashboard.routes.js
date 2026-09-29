import { Router } from 'express';
import adminDashboardController from './admin_dashboard.controller.js';
import { requireAdminAuth } from '../../middlewares/adminAuth.middleware.js';

const router = Router();

router.get('/', requireAdminAuth, adminDashboardController.getDashboard);

export default router;
