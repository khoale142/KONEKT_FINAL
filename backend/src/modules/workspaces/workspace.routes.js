import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { getWorkspaces, select } from './workspace.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', getWorkspaces);
router.post('/select', select);

export default router;
