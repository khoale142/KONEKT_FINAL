const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

let adminToken = localStorage.getItem('adminAccessToken') || '';

export function setAdminToken(token) {
  adminToken = token;
  if (token) {
    localStorage.setItem('adminAccessToken', token);
  } else {
    localStorage.removeItem('adminAccessToken');
  }
}

export function getAdminToken() {
  return adminToken || localStorage.getItem('adminAccessToken') || '';
}

export function clearAdminToken() {
  adminToken = '';
  localStorage.removeItem('adminAccessToken');
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const activeToken = getAdminToken();

  if (activeToken) {
    headers.Authorization = `Bearer ${activeToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const payload = await response.json().catch(() => ({}));

  if (response.status === 401) {
    clearAdminToken();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/admin/login')) {
      window.location.href = '/admin/login';
    }
  }

  if (!response.ok || payload.success === false) {
    const error = new Error(payload.message || 'Yêu cầu quản trị thất bại.');
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export const adminApiClient = {
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

  put(path, body) {
    return request(path, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  delete(path) {
    return request(path, { method: 'DELETE' });
  },
};

export default adminApiClient;
