import { Router } from 'express';
import adminAuthController from './admin_auth.controller.js';
import { requireAdminAuth } from '../../middlewares/adminAuth.middleware.js';

const router = Router();

router.post('/login', adminAuthController.login);
router.post('/forgot-password', adminAuthController.forgotPassword);
router.post('/reset-password', adminAuthController.resetPassword);
router.post('/logout', adminAuthController.logout);

router.get('/me', requireAdminAuth, adminAuthController.getMe);
router.patch('/profile', requireAdminAuth, adminAuthController.updateProfile);
router.patch('/change-password', requireAdminAuth, adminAuthController.changePassword);
router.get('/security', requireAdminAuth, adminAuthController.getSecurityDetails);

export default router;
