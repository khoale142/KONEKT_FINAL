import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requireOwner, requireWorkspace } from '../../middlewares/role.middleware.js';
import { create, getTenants, getTenant } from './tenant.controller.js';

const router = Router();

router.use(requireAuth);

router.post('/', create);
router.get('/', getTenants);
router.get('/:id', requireWorkspace(), requireOwner(), getTenant);

export default router;
