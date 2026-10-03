import axios from 'axios';
import { getToken, clearSession } from './authStorage';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1',
  timeout: Number(import.meta.env.VITE_API_TIMEOUT) || 15000,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Excel/PDF downloads use responseType 'blob', so a failed download carries the
    // ApiError JSON inside a Blob. Read it so the user sees the real message.
    let serverMessage = error.response?.data?.message;
    const body = error.response?.data;
    if (!serverMessage && typeof Blob !== 'undefined' && body instanceof Blob) {
      try {
        serverMessage = JSON.parse(await body.text()).message;
      } catch {
        /* body was not JSON — fall back to the generic message */
      }
    }
    const message = serverMessage || error.message || 'Something went wrong.';

    // If the server says we're not authenticated, clear stale credentials and
    // send the user back to the login page so they get a fresh JWT.
    if (error.response?.status === 401) {
      clearSession();
      // Only redirect if we're not already on a login/landing page
      const current = window.location.pathname;
      const publicPaths = ['/login', '/forgot-password', '/reset-password', '/'];
      if (!publicPaths.some((p) => current === p || current.startsWith(p + '/'))) {
        window.location.href = '/';
      }
    }

    const err = new Error(message);
    err.status = error.response?.status;
    return Promise.reject(err);
  },
);

export default api;