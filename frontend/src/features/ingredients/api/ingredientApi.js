import { apiClient } from '../../../services/apiClient.js';

function buildQueryString(filters = {}) {
  const query = new URLSearchParams();

  if (filters.search) {
    query.set('search', filters.search);
  }

  if (filters.lowStock) {
    query.set('lowStock', 'true');
  }

  if (filters.categoryId && filters.categoryId !== 'ALL') {
    query.set('categoryId', filters.categoryId);
  }

  const queryString = query.toString();
  return queryString ? `?${queryString}` : '';
}

export const ingredientApi = {
  getIngredients(filters = {}) {
    return apiClient.get(`/ingredients${buildQueryString(filters)}`);
  },
  getIngredient(id) {
    return apiClient.get(`/ingredients/${id}`);
  },
  createIngredient(data) {
    return apiClient.post('/ingredients', data);
  },
  createPreparation(data) {
    return apiClient.post('/ingredients/preparations', data);
  },
  updatePreparation(id, data) {
    return apiClient.put(`/ingredients/preparations/${id}`, data);
  },
  bulkCreateIngredients(data) {
    return apiClient.post('/ingredients/bulk', data);
  },
  bulkCreatePreparations(data) {
    return apiClient.post('/ingredients/preparations/bulk', data);
  },
  assignIngredientsToCategory(data) {
    return apiClient.patch('/ingredients/categories', data);
  },
  updateIngredient(id, data) {
    return apiClient.patch(`/ingredients/${id}`, data);
  },
  deleteIngredient(id) {
    return apiClient.delete(`/ingredients/${id}`);
  },
  getIngredientRecipe(id) {
    return apiClient.get(`/ingredients/${id}/recipe`);
  },
  updateIngredientRecipe(id, data) {
    return apiClient.put(`/ingredients/${id}/recipe`, data);
  },
};

export default ingredientApi;
