import { sendSuccess } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { createCategory, deleteCategory, listCategories, updateCategory } from './category.service.js';

export const getCategories = asyncHandler(async (req, res) => {
  const categories = await listCategories(req.query, req.workspace.storeId);
  return sendSuccess(res, { message: 'Categories loaded successfully.', data: { categories } });
});

export const createNewCategory = asyncHandler(async (req, res) => {
  const category = await createCategory(req.body, req.user, req.workspace.storeId);
  return sendSuccess(res, { message: 'Category created successfully.', statusCode: 201, data: { category } });
});

export const updateExistingCategory = asyncHandler(async (req, res) => {
  const category = await updateCategory(req.params.id, req.body, req.workspace.storeId);
  return sendSuccess(res, { message: 'Category updated successfully.', data: { category } });
});

export const deleteExistingCategory = asyncHandler(async (req, res) => {
  const category = await deleteCategory(req.params.id, req.workspace.storeId);
  return sendSuccess(res, { message: 'Category deleted successfully.', data: { category } });
});
