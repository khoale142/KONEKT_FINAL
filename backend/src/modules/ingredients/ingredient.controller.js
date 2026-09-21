import { sendSuccess } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  createIngredient,
  getIngredientById,
  listIngredients,
  softDeleteIngredient,
  updateIngredient,
  getIngredientRecipe,
  replaceIngredientRecipe,
  createBulkIngredients,
  assignIngredientsToCategory,
  createPreparation,
  createBulkCompletedPreparations,
  updatePreparation,
} from './ingredient.service.js';
import { pool } from '../../config/db.js';

export const getIngredients = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const ingredients = await listIngredients(req.query, storeId);

  return sendSuccess(res, {
    message: 'Ingredients loaded successfully.',
    data: {
      ingredients,
    },
  });
});

export const getIngredient = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const ingredient = await getIngredientById(req.params.id, storeId);

  return sendSuccess(res, {
    message: 'Ingredient loaded successfully.',
    data: {
      ingredient,
    },
  });
});

export const createNewIngredient = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const ingredient = await createIngredient(req.body, req.user, storeId);

  return sendSuccess(res, {
    message: 'Ingredient created successfully.',
    statusCode: 201,
    data: {
      ingredient,
    },
  });
});

export const createNewPreparation = asyncHandler(async (req, res) => {
  const preparation = await createPreparation(req.body, req.user, req.workspace.storeId);

  return sendSuccess(res, {
    message: 'Preparation created successfully.',
    statusCode: 201,
    data: preparation,
  });
});

export const bulkCreateCompletedPreparations = asyncHandler(async (req, res) => {
  const preparations = await createBulkCompletedPreparations(
    req.body,
    req.user,
    req.workspace.storeId,
  );

  return sendSuccess(res, {
    message: 'Preparations bulk created successfully.',
    statusCode: 201,
    data: { preparations },
  });
});

export const updateExistingPreparation = asyncHandler(async (req, res) => {
  const preparation = await updatePreparation(
    req.params.id,
    req.body,
    req.user,
    req.workspace.storeId,
  );

  return sendSuccess(res, {
    message: 'Preparation updated successfully.',
    data: preparation,
  });
});

export const bulkCreateIngredients = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const ingredients = await createBulkIngredients(req.body, req.user, storeId);

  return sendSuccess(res, {
    message: 'Ingredients bulk created successfully.',
    statusCode: 201,
    data: {
      ingredients,
    },
  });
});

export const updateExistingIngredient = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const ingredient = await updateIngredient(req.params.id, req.body, storeId);

  return sendSuccess(res, {
    message: 'Ingredient updated successfully.',
    data: {
      ingredient,
    },
  });
});

export const assignIngredientsToCategoryController = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const ingredients = await assignIngredientsToCategory(req.body, storeId);

  return sendSuccess(res, {
    message: 'Ingredient categories updated successfully.',
    data: { ingredients },
  });
});

export const deleteExistingIngredient = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const ingredient = await softDeleteIngredient(req.params.id, storeId);

  return sendSuccess(res, {
    message: 'Ingredient deleted successfully.',
    data: {
      ingredient,
    },
  });
});

export const getIngredientRecipeController = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const recipe = await getIngredientRecipe(req.params.id, storeId);

  return sendSuccess(res, {
    message: 'Recipe loaded successfully.',
    data: {
      recipe,
    },
  });
});

export const updateIngredientRecipeController = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await replaceIngredientRecipe(client, req.params.id, req.user.id, storeId, req.body);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  const recipe = await getIngredientRecipe(req.params.id, storeId);

  return sendSuccess(res, {
    message: 'Recipe updated successfully.',
    data: {
      recipe,
    },
  });
});
