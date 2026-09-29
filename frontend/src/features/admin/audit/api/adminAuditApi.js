import { adminApiClient, getAdminToken } from '../../../../services/adminApiClient.js';

export async function fetchAuditLogs(params = {}) {
  const query = new URLSearchParams();
  if (params.search) query.append('search', params.search);
  if (params.actionType && params.actionType !== 'ALL') query.append('actionType', params.actionType);
  if (params.scope && params.scope !== 'ALL') query.append('scope', params.scope);
  if (params.actorId && params.actorId !== 'ALL') query.append('actorId', params.actorId);
  if (params.timeRange && params.timeRange !== 'ALL') query.append('timeRange', params.timeRange);
  if (params.page) query.append('page', params.page);
  if (params.limit) query.append('limit', params.limit);

  const url = `/admin/audit${query.toString() ? `?${query.toString()}` : ''}`;
  return adminApiClient.get(url);
}

export async function fetchAuditLogDetail(id) {
  return adminApiClient.get(`/admin/audit/${id}`);
}

export async function exportAuditLogs(params = {}, format = 'csv') {
  const query = new URLSearchParams();
  if (params.search) query.append('search', params.search);
  if (params.actionType && params.actionType !== 'ALL') query.append('actionType', params.actionType);
  if (params.scope && params.scope !== 'ALL') query.append('scope', params.scope);
  if (params.actorId && params.actorId !== 'ALL') query.append('actorId', params.actorId);
  if (params.timeRange && params.timeRange !== 'ALL') query.append('timeRange', params.timeRange);
  query.append('format', format);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
  const url = `${API_BASE_URL}/admin/audit/export?${query.toString()}`;

  const token = getAdminToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error('Không thể xuất dữ liệu nhật ký kiểm toán');

  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(downloadUrl);
}

export default {
  fetchAuditLogs,
  fetchAuditLogDetail,
  exportAuditLogs,
};
