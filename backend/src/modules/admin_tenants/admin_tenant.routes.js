import { Router } from 'express';
import adminTenantController from './admin_tenant.controller.js';
import { requireAdminAuth } from '../../middlewares/adminAuth.middleware.js';

const router = Router();

router.use(requireAdminAuth);

router.get('/', adminTenantController.getTenants);
router.get('/:id', adminTenantController.getTenant);
router.post('/', adminTenantController.createTenant);
router.put('/:id', adminTenantController.updateTenant);
router.patch('/:id/status', adminTenantController.toggleStatus);
router.post('/:id/owners', adminTenantController.addOwner);
router.delete('/:id/owners/:userId', adminTenantController.removeOwner);

export default router;
