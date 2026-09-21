import { apiClient } from '../../../services/apiClient.js';

export const categoryApi = {
  getCategories(scope) {
    const query = scope ? `?scope=${encodeURIComponent(scope)}` : '';
    return apiClient.get(`/categories${query}`);
  },
  createCategory(data) {
    return apiClient.post('/categories', data);
  },
  updateCategory(id, data) {
    return apiClient.patch(`/categories/${id}`, data);
  },
  deleteCategory(id) {
    return apiClient.delete(`/categories/${id}`);
  },
};

export default categoryApi;
