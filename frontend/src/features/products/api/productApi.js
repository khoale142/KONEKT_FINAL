import { apiClient } from '../../../services/apiClient.js';

function buildQueryString(filters = {}) {
  const query = new URLSearchParams();

  if (filters.search) {
    query.set('search', filters.search);
  }

  if (filters.status && filters.status !== 'ALL') {
    query.set('status', filters.status);
  }

  if (filters.categoryId && filters.categoryId !== 'ALL') {
    query.set('categoryId', filters.categoryId);
  }

  const queryString = query.toString();
  return queryString ? `?${queryString}` : '';
}

export const productApi = {
  getProducts(filters = {}) {
    return apiClient.get(`/products${buildQueryString(filters)}`);
  },
  getProduct(id) {
    return apiClient.get(`/products/${id}`);
  },
  createProduct(data) {
    return apiClient.post('/products', data);
  },
  bulkCreateProducts(data) {
    return apiClient.post('/products/bulk', data);
  },
  assignProductsToCategory(data) {
    return apiClient.patch('/products/categories', data);
  },
  updateProduct(id, data) {
    return apiClient.patch(`/products/${id}`, data);
  },
  addSize(id, data) {
    return apiClient.post(`/products/${id}/sizes`, data);
  },
  updateSize(id, sizeId, data) {
    return apiClient.patch(`/products/${id}/sizes/${sizeId}`, data);
  },
  reorderSizes(id, sizeIds) {
    return apiClient.patch(`/products/${id}/sizes/reorder`, { sizeIds });
  },
  deleteSize(id, sizeId) {
    return apiClient.delete(`/products/${id}/sizes/${sizeId}`);
  },
  deleteProduct(id) {
    return apiClient.delete(`/products/${id}`);
  },
  getPosAvailableProducts() {
    return apiClient.get('/products/pos/available');
  },
};

export default productApi;
