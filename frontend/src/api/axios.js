import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
});

api.interceptors.request.use((config) => {
  // Read from sessionStorage first (tab-isolated), then fallback to localStorage
  const token = sessionStorage.getItem('urbs_token') || localStorage.getItem('urbs_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Only redirect to /login on 401 when:
    // 1. The failing request was NOT /auth/login or /auth/register
    //    (prevents redirect loop / page-refresh on wrong-password attempts)
    // 2. A token exists, meaning the session expired rather than bad credentials
    const url = err.config?.url || '';
    const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/register');

    if (err.response?.status === 401 && !isAuthEndpoint) {
      sessionStorage.removeItem('urbs_token');
      sessionStorage.removeItem('urbs_user');
      localStorage.removeItem('urbs_token');
      localStorage.removeItem('urbs_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
