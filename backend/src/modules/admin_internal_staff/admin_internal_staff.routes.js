import { Router } from 'express';
import adminInternalStaffController from './admin_internal_staff.controller.js';
import { requireAdminAuth } from '../../middlewares/adminAuth.middleware.js';

const router = Router();

router.use(requireAdminAuth);

router.get('/', adminInternalStaffController.getStaffList);
router.get('/:id', adminInternalStaffController.getStaffDetail);
router.post('/', adminInternalStaffController.addStaff);
router.patch('/:id/role', adminInternalStaffController.updateStaffRole);
router.patch('/:id/status', adminInternalStaffController.toggleStaffStatus);
router.post('/:id/reset-password', adminInternalStaffController.resetStaffPassword);

export default router;
