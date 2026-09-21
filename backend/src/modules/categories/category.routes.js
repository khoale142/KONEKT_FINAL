import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requireStoreContext, requireStoreManager } from '../../middlewares/role.middleware.js';
import { createNewCategory, deleteExistingCategory, getCategories, updateExistingCategory } from './category.controller.js';

const router = Router();
router.use(requireAuth, requireStoreContext());
router.get('/', getCategories);
router.post('/', requireStoreManager(), createNewCategory);
router.patch('/:id', requireStoreManager(), updateExistingCategory);
router.delete('/:id', requireStoreManager(), deleteExistingCategory);

export default router;
