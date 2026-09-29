import { adminApiClient } from '../../../../services/adminApiClient.js';

export const adminStoreApi = {
  getStore: (id) => adminApiClient.get(`/admin/stores/${id}`),

  updateStore: (id, data) => adminApiClient.put(`/admin/stores/${id}`, data),

  toggleStatus: (id, status) => adminApiClient.patch(`/admin/stores/${id}/status`, { status }),

  regenerateInviteCode: (id) => adminApiClient.post(`/admin/stores/${id}/regenerate-invite-code`),

  addMember: (id, data) => adminApiClient.post(`/admin/stores/${id}/staff`, data),

  updateMemberRole: (id, userId, role) => adminApiClient.patch(`/admin/stores/${id}/staff/${userId}/role`, { role }),

  removeMember: (id, userId) => adminApiClient.delete(`/admin/stores/${id}/staff/${userId}`),
};

export default adminStoreApi;
