import { adminApiClient } from '../../../../services/adminApiClient.js';

export const adminAuthApi = {
  login({ email, password, remember = false }) {
    return adminApiClient.post('/admin/auth/login', { email, password, remember });
  },

  getMe() {
    return adminApiClient.get('/admin/auth/me');
  },

  forgotPassword({ email }) {
    return adminApiClient.post('/admin/auth/forgot-password', { email });
  },

  resetPassword({ email, token, newPassword }) {
    return adminApiClient.post('/admin/auth/reset-password', { email, token, newPassword });
  },

  logout() {
    return adminApiClient.post('/admin/auth/logout', {});
  },

  updateProfile(data) {
    return adminApiClient.patch('/admin/auth/profile', data);
  },

  changePassword(data) {
    return adminApiClient.patch('/admin/auth/change-password', data);
  },

  getSecurityDetails() {
    return adminApiClient.get('/admin/auth/security');
  },
};

export default adminAuthApi;
