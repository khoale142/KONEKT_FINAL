import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requireStoreManager, requireStoreContext } from '../../middlewares/role.middleware.js';
import {
  createNewIngredient,
  deleteExistingIngredient,
  getIngredient,
  getIngredients,
  updateExistingIngredient,
  getIngredientRecipeController,
  updateIngredientRecipeController,
  bulkCreateIngredients,
  assignIngredientsToCategoryController,
  createNewPreparation,
  bulkCreateCompletedPreparations,
  updateExistingPreparation,
} from './ingredient.controller.js';

const router = Router();

router.use(requireAuth, requireStoreContext());

router.get('/', getIngredients);
router.post('/preparations/bulk', requireStoreManager(), bulkCreateCompletedPreparations);
router.post('/preparations', requireStoreManager(), createNewPreparation);
router.put('/preparations/:id', requireStoreManager(), updateExistingPreparation);
router.get('/:id', getIngredient);

router.post('/bulk', requireStoreManager(), bulkCreateIngredients);
router.patch('/categories', requireStoreManager(), assignIngredientsToCategoryController);
router.post('/', requireStoreManager(), createNewIngredient);
router.patch('/:id', requireStoreManager(), updateExistingIngredient);
router.delete('/:id', requireStoreManager(), deleteExistingIngredient);

router.get('/:id/recipe', getIngredientRecipeController);
router.put('/:id/recipe', requireStoreManager(), updateIngredientRecipeController);

export default router;
