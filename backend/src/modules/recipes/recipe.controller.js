import { sendSuccess } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  createRecipe,
  getRecipeById,
  getRecipeByProductId,
  listRecipes,
  softDeleteRecipe,
  updateRecipe,
} from './recipe.service.js';

export const getRecipes = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const recipes = await listRecipes(req.query, storeId);

  return sendSuccess(res, {
    message: 'Recipes loaded successfully.',
    data: {
      recipes,
    },
  });
});

export const getRecipe = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const recipe = await getRecipeById(req.params.id, storeId);

  return sendSuccess(res, {
    message: 'Recipe loaded successfully.',
    data: {
      recipe,
    },
  });
});

export const getRecipeByProduct = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const recipe = await getRecipeByProductId(req.params.productId, storeId);

  return sendSuccess(res, {
    message: 'Product recipe loaded successfully.',
    data: {
      recipe,
    },
  });
});

export const createNewRecipe = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const recipe = await createRecipe(req.body, req.user, storeId);

  return sendSuccess(res, {
    message: 'Recipe created successfully.',
    statusCode: 201,
    data: {
      recipe,
    },
  });
});

export const updateExistingRecipe = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const recipe = await updateRecipe(req.params.id, req.body, storeId);

  return sendSuccess(res, {
    message: 'Recipe updated successfully.',
    data: {
      recipe,
    },
  });
});

export const deleteExistingRecipe = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const recipe = await softDeleteRecipe(req.params.id, storeId);

  return sendSuccess(res, {
    message: 'Recipe deleted successfully.',
    data: {
      recipe,
    },
  });
});
