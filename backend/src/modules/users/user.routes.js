import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requireOwner, requireStoreContext } from '../../middlewares/role.middleware.js';
import { getStoreStaffDetail, getStoreStaffList, kickStaffFromStore, resetPassword } from './user.controller.js';

const router = Router();

router.use(requireAuth, requireStoreContext(), requireOwner());

router.get('/', getStoreStaffList);
router.get('/:id', getStoreStaffDetail);
router.delete('/:id', kickStaffFromStore);
router.post('/:id/reset-password', resetPassword);

export default router;
