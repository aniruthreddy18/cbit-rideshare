import axios from 'axios';

const TOKEN_KEY = 'cbit_rideshare_token';

export const tokenStore = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* storage unavailable (private mode) - session lasts until reload */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

const api = axios.create({
  // In development requests go to /api on the Vite server, which proxies to Express.
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    const isAuthCall = url.startsWith('/auth/login') || url.startsWith('/auth/register');
    if (error.response?.status === 401 && !isAuthCall && tokenStore.get()) {
      tokenStore.clear();
      window.dispatchEvent(new CustomEvent('auth:expired', { detail: getErrorMessage(error) }));
    }
    return Promise.reject(error);
  }
);

/** Turn any Axios error into a message a student can act on. */
export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback;
  const data = error.response?.data;
  if (data && typeof data === 'object' && data.message) return data.message;

  if (error.code === 'ECONNABORTED') return 'The server took too long to respond. Please try again.';
  if (!error.response) {
    return 'Cannot reach the CBIT RideShare server. Make sure the backend is running (cd backend; npm run dev).';
  }
  const { status } = error.response;
  // The Vite proxy answers 500/502/504 with no JSON body when Express is not running.
  if ([500, 502, 503, 504].includes(status) && (!data || typeof data !== 'object')) {
    return `Backend unavailable (HTTP ${status}). Start it with: cd backend; npm run dev`;
  }
  if (status === 404) return 'Requested resource was not found.';
  return `${fallback} (HTTP ${status})`;
}

/** Field-level validation errors from the API: { email: '...', phone: '...' }. */
export function getFieldErrors(error) {
  const errors = error?.response?.data?.errors;
  return errors && typeof errors === 'object' ? errors : {};
}

// ---- Endpoints (must match backend/src/routes) ----------------------------
export const authApi = {
  register: (payload) => api.post('/auth/register', payload).then((r) => r.data),
  login: (payload) => api.post('/auth/login', payload).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
};

export const ridesApi = {
  list: (params) => api.get('/rides', { params }).then((r) => r.data),
  mine: () => api.get('/rides/mine').then((r) => r.data),
  get: (id) => api.get(`/rides/${id}`).then((r) => r.data),
  create: (payload) => api.post('/rides', payload).then((r) => r.data),
  update: (id, payload) => api.put(`/rides/${id}`, payload).then((r) => r.data),
  cancel: (id) => api.delete(`/rides/${id}`).then((r) => r.data),
};

export const bookingsApi = {
  request: (rideId, message) => api.post('/bookings', { rideId, message }).then((r) => r.data),
  mine: () => api.get('/bookings/mine').then((r) => r.data),
  requests: (status) => api.get('/bookings/requests', { params: status ? { status } : {} }).then((r) => r.data),
  accept: (id) => api.patch(`/bookings/${id}/accept`).then((r) => r.data),
  reject: (id) => api.patch(`/bookings/${id}/reject`).then((r) => r.data),
  cancel: (id) => api.patch(`/bookings/${id}/cancel`).then((r) => r.data),
};

export default api;
