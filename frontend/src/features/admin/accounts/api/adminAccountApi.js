import { adminApiClient } from '../../../../services/adminApiClient.js';

export const adminAccountApi = {
  getAccounts(params = {}) {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.status && params.status !== 'ALL') query.set('status', params.status);
    if (params.relation && params.relation !== 'ALL') query.set('relation', params.relation);
    if (params.sort) query.set('sort', params.sort);
    if (params.page) query.set('page', params.page);
    if (params.limit) query.set('limit', params.limit);

    const queryString = query.toString();
    return adminApiClient.get(`/admin/accounts${queryString ? `?${queryString}` : ''}`);
  },

  getAccount(id) {
    return adminApiClient.get(`/admin/accounts/${id}`);
  },

  createAccount(data) {
    return adminApiClient.post('/admin/accounts', data);
  },

  updateAccount(id, data) {
    return adminApiClient.put(`/admin/accounts/${id}`, data);
  },

  toggleStatus(id, status, reason = '') {
    return adminApiClient.patch(`/admin/accounts/${id}/status`, { status, reason });
  },

  resetPassword(id, newPassword) {
    return adminApiClient.post(`/admin/accounts/${id}/reset-password`, { newPassword });
  },
};

export default adminAccountApi;
