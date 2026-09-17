import { apiClient } from '../../../services/apiClient.js';

export const authApi = {
  login({ username, password }) {
    return apiClient.post('/auth/login', { username, password });
  },
  register({ username, password, fullName, email, phone }) {
    return apiClient.post('/auth/register', { username, password, fullName, email, phone });
  },
  getMe() {
    return apiClient.get('/auth/me');
  },
  updateProfile(data) {
    return apiClient.patch('/auth/me', data);
  },
  changePassword(data) {
    return apiClient.patch('/auth/change-password', data);
  },
  forgotPassword({ email, username }) {
    return apiClient.post('/auth/forgot-password', { email, username });
  },
  resetPassword({ email, token, newPassword }) {
    return apiClient.post('/auth/reset-password', { email, token, newPassword });
  },
};
export default authApi;
