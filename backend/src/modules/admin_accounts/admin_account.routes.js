import { Router } from 'express';
import adminAccountController from './admin_account.controller.js';
import { requireAdminAuth } from '../../middlewares/adminAuth.middleware.js';

const router = Router();

router.use(requireAdminAuth);

router.get('/', adminAccountController.getAccounts);
router.get('/:id', adminAccountController.getAccount);
router.post('/', adminAccountController.createAccount);
router.put('/:id', adminAccountController.updateAccount);
router.patch('/:id/status', adminAccountController.toggleAccountStatus);
router.post('/:id/reset-password', adminAccountController.resetAccountPassword);

export default router;
