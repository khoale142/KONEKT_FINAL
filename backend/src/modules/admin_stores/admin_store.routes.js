import { Router } from 'express';
import adminStoreController from './admin_store.controller.js';
import { requireAdminAuth } from '../../middlewares/adminAuth.middleware.js';

const router = Router();

router.use(requireAdminAuth);

router.get('/:id', adminStoreController.getStore);
router.put('/:id', adminStoreController.updateStore);
router.patch('/:id/status', adminStoreController.toggleStoreStatus);
router.post('/:id/regenerate-invite-code', adminStoreController.regenerateInviteCode);
router.post('/:id/staff', adminStoreController.addStoreMember);
router.patch('/:id/staff/:userId/role', adminStoreController.updateStoreMemberRole);
router.delete('/:id/staff/:userId', adminStoreController.removeStoreMember);

export default router;
