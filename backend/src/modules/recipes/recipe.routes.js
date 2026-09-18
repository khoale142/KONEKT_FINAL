import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requireStoreManager, requireStoreContext } from '../../middlewares/role.middleware.js';
import {
  createNewRecipe,
  deleteExistingRecipe,
  getRecipe,
  getRecipeByProduct,
  getRecipes,
  updateExistingRecipe,
} from './recipe.controller.js';

const router = Router();


router.use(requireAuth, requireStoreContext());

router.get('/', getRecipes);
router.get('/:id', getRecipe);
router.get('/products/:productId', getRecipeByProduct);

router.post('/', requireStoreManager(), createNewRecipe);
router.put('/:id', requireStoreManager(), updateExistingRecipe);
router.delete('/:id', requireStoreManager(), deleteExistingRecipe);

export default router;
