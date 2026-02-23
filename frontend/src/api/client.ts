import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Skip redirect for auth endpoints — let the component handle the error
    const isAuthRequest = originalRequest?.url?.startsWith('/auth/');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRequest) {
      originalRequest._retry = true;
      console.warn('[AUTH] 401 received for', originalRequest.url, '— attempting token refresh');

      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const { data } = await axios.post('/api/auth/refresh', {
            refresh_token: refreshToken,
          });
          console.log('[AUTH] Token refresh SUCCESS');
          localStorage.setItem('access_token', data.access_token);
          localStorage.setItem('refresh_token', data.refresh_token);
          useAuthStore.getState().loadFromStorage(); // keep Zustand store in sync
          originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
          return api(originalRequest);
        } catch (refreshErr) {
          console.error('[AUTH] Token refresh FAILED — redirecting to /login', refreshErr);
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
      } else {
        console.error('[AUTH] No refresh_token — redirecting to /login');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;
