import { apiClient } from '../../../services/apiClient.js';

function buildQueryString(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      query.set(key, val);
    }
  });
  const queryString = query.toString();
  return queryString ? `?${queryString}` : '';
}

export const hrApi = {
  // Shifts master data
  getShifts() {
    return apiClient.get('/hr/shifts');
  },
  createShift(data) {
    return apiClient.post('/hr/shifts', data);
  },
  updateShift(id, data) {
    return apiClient.put(`/hr/shifts/${id}`, data);
  },
  deleteShift(id) {
    return apiClient.delete(`/hr/shifts/${id}`);
  },

  // Availability
  getAvailability(params = {}) {
    return apiClient.get(`/hr/availabilities${buildQueryString(params)}`);
  },
  getMyAvailability(params = {}) {
    return apiClient.get(`/hr/my-availabilities${buildQueryString(params)}`);
  },
  createAvailability(data) {
    return apiClient.post('/hr/availabilities', data);
  },
  deleteAvailability(id) {
    return apiClient.delete(`/hr/availabilities/${id}`);
  },
  deleteMyAvailability(id) {
    return apiClient.delete(`/hr/my-availabilities/${id}`);
  },

  // Shift assignment
  getAssignedShifts(params = {}) {
    return apiClient.get(`/hr/assigned-shifts${buildQueryString(params)}`);
  },
  getMyAssignedShifts(params = {}) {
    return apiClient.get(`/hr/my-assigned-shifts${buildQueryString(params)}`);
  },
  assignShift(data) {
    return apiClient.post('/hr/assigned-shifts', data);
  },
  changeShiftStatus(id, status) {
    return apiClient.patch(`/hr/assigned-shifts/${id}/status`, { status });
  },
  deleteAssignedShift(id) {
    return apiClient.delete(`/hr/assigned-shifts/${id}`);
  },

  // Requests
  getRequests(params = {}) {
    return apiClient.get(`/hr/requests${buildQueryString(params)}`);
  },
  getMyRequests(params = {}) {
    return apiClient.get(`/hr/my-requests${buildQueryString(params)}`);
  },
  createRequest(data) {
    return apiClient.post('/hr/requests', data);
  },
  processRequest(id, data) {
    return apiClient.patch(`/hr/requests/${id}/process`, data);
  },
  getStaffList() {
    return apiClient.get('/hr/staff');
  },

  // Salary & reports
  getMySalary(params = {}) {
    return apiClient.get(`/hr/reports/my-salary${buildQueryString(params)}`);
  },
  getAdminHRCosts(params = {}) {
    return apiClient.get(`/hr/reports/hr-costs${buildQueryString(params)}`);
  },
};

export default hrApi;
