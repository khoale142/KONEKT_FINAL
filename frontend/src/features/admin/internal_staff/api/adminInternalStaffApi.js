import { adminApiClient } from '../../../../services/adminApiClient.js';

export const adminInternalStaffApi = {
  getStaffList(params = {}) {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.status && params.status !== 'ALL') query.set('status', params.status);
    if (params.role && params.role !== 'ALL') query.set('role', params.role);
    if (params.sort) query.set('sort', params.sort);
    if (params.page) query.set('page', params.page);
    if (params.limit) query.set('limit', params.limit);

    const queryString = query.toString();
    return adminApiClient.get(`/admin/internal-staff${queryString ? `?${queryString}` : ''}`);
  },

  getStaffDetail(id) {
    return adminApiClient.get(`/admin/internal-staff/${id}`);
  },

  addStaff(data) {
    return adminApiClient.post('/admin/internal-staff', data);
  },

  updateRole(id, role) {
    return adminApiClient.patch(`/admin/internal-staff/${id}/role`, { role });
  },

  toggleStatus(id, status, reason = '') {
    return adminApiClient.patch(`/admin/internal-staff/${id}/status`, { status, reason });
  },

  resetPassword(id, newPassword) {
    return adminApiClient.post(`/admin/internal-staff/${id}/reset-password`, { newPassword });
  },
};

export default adminInternalStaffApi;
