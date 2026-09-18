import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requireStoreManager, requireStoreContext } from '../../middlewares/role.middleware.js';
import {
  createNewIngredient,
  deleteExistingIngredient,
  getIngredient,
  getIngredients,
  updateExistingIngredient,
} from './ingredient.controller.js';

const router = Router();

router.use(requireAuth, requireStoreContext());

router.get('/', getIngredients);
router.get('/:id', getIngredient);

router.post('/', requireStoreManager(), createNewIngredient);
router.patch('/:id', requireStoreManager(), updateExistingIngredient);
router.delete('/:id', requireStoreManager(), deleteExistingIngredient);

export default router;
