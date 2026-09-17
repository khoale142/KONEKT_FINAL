import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { changePassword, login, register, me, updateMe, forgotPassword, resetPassword } from './auth.controller.js';

const router = Router();

router.post('/login', login);
router.post('/register', register);
router.get('/me', requireAuth, me);
router.patch('/me', requireAuth, updateMe);
router.patch('/change-password', requireAuth, changePassword);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

export default router;
