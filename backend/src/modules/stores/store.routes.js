import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requireOwner, requireWorkspace } from '../../middlewares/role.middleware.js';
import { create, getStoreStaff, join, regenerateCode, removeStaff, updateStaffRole } from './store.controller.js';

const router = Router();

// Join store (public to any logged-in user, requires invite code)
router.post('/join', requireAuth, join);

// Owner-only routes (requires workspace context type = TENANT)
router.use(requireAuth, requireWorkspace(), requireOwner());

router.post('/', create);
router.get('/:id/staff', getStoreStaff);
router.patch('/:id/staff/:userId/role', updateStaffRole);
router.delete('/:id/staff/:userId', removeStaff);
router.post('/:id/regenerate-code', regenerateCode);

export default router;
