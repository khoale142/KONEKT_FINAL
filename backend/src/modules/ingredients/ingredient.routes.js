import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requireOwner, requireStoreContext } from '../../middlewares/role.middleware.js';
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

router.post('/', requireOwner(), createNewIngredient);
router.patch('/:id', requireOwner(), updateExistingIngredient);
router.delete('/:id', requireOwner(), deleteExistingIngredient);

export default router;
