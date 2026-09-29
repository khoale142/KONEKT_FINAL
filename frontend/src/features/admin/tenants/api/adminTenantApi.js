import { adminApiClient } from '../../../../services/adminApiClient.js';

export const adminTenantApi = {
  getTenants(params = {}) {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.status && params.status !== 'ALL') query.set('status', params.status);
    if (params.sort) query.set('sort', params.sort);
    if (params.page) query.set('page', params.page);
    if (params.limit) query.set('limit', params.limit);

    const queryString = query.toString();
    return adminApiClient.get(`/admin/tenants${queryString ? `?${queryString}` : ''}`);
  },

  getTenant(id) {
    return adminApiClient.get(`/admin/tenants/${id}`);
  },

  createTenant(data) {
    return adminApiClient.post('/admin/tenants', data);
  },

  updateTenant(id, data) {
    return adminApiClient.put(`/admin/tenants/${id}`, data);
  },

  toggleStatus(id, status) {
    return adminApiClient.patch(`/admin/tenants/${id}/status`, { status });
  },

  addOwner(id, data) {
    return adminApiClient.post(`/admin/tenants/${id}/owners`, data);
  },

  removeOwner(id, userId) {
    return adminApiClient.delete(`/admin/tenants/${id}/owners/${userId}`);
  },
};

export default adminTenantApi;
