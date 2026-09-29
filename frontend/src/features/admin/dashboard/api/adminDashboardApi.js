import { adminApiClient } from '../../../../services/adminApiClient.js';

export const adminDashboardApi = {
  getStats() {
    return adminApiClient.get('/admin/dashboard');
  },
};

export default adminDashboardApi;
