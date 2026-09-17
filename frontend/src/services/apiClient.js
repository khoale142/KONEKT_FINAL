const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

let authToken = localStorage.getItem('accessToken') || '';
let workspaceToken = localStorage.getItem('workspaceToken') || '';

export function setAuthToken(token) {
  authToken = token;
  localStorage.setItem('accessToken', token);
}

export function clearAuthToken() {
  authToken = '';
  localStorage.removeItem('accessToken');
}

export function setWorkspaceToken(token) {
  workspaceToken = token;
  localStorage.setItem('workspaceToken', token);
}

export function clearWorkspaceToken() {
  workspaceToken = '';
  localStorage.removeItem('workspaceToken');
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const activeToken = workspaceToken || authToken;

  if (activeToken) {
    headers.Authorization = `Bearer ${activeToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const payload = await response.json().catch(() => ({}));

  if (response.status === 401) {
    clearAuthToken();
    clearWorkspaceToken();
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }

  if (!response.ok || payload.success === false) {
    const error = new Error(payload.message || 'Request failed');
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export const apiClient = {
  get(path) {
    return request(path, { method: 'GET' });
  },

  post(path, body) {
    return request(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  patch(path, body) {
    return request(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  delete(path) {
    return request(path, { method: 'DELETE' });
  },
};
