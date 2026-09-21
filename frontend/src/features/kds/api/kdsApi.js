import { apiClient } from '../../../services/apiClient.js';

export const kdsApi = {
  getOrders() {
    return apiClient.get('/kds');
  },
  completeOrder(orderId) {
    return apiClient.post(`/kds/${orderId}/complete`, {});
  },
};

export default kdsApi;
