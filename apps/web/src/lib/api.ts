import axios from 'axios';
import { useAuthStore } from '../stores/auth.store';

export const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Refresh token logic ───────────────────────────────────────────────────────
let isRefreshing = false;
let pendingQueue: Array<(token: string) => void> = [];

function processQueue(newToken: string) {
  pendingQueue.forEach((cb) => cb(newToken));
  pendingQueue = [];
}

// On 401 — attempt token refresh; on failure clear auth and redirect
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config as typeof error.config & { _retry?: boolean };

    if (error?.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    const rt = localStorage.getItem('if-fleet-rt');
    if (!rt) {
      useAuthStore.getState().clearAuth();
      window.location.href = '/login';
      return Promise.reject(error);
    }

    // If a refresh is already in flight, queue this request until it resolves
    if (isRefreshing) {
      return new Promise<unknown>((resolve) => {
        pendingQueue.push((token: string) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          resolve(api(originalRequest));
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const { data } = await axios.post<{ accessToken: string }>(
        '/api/v1/auth/refresh',
        { refreshToken: rt },
        { headers: { 'Content-Type': 'application/json' } },
      );
      const newToken = data.accessToken;

      // Persist new access token
      const currentUser = useAuthStore.getState().user;
      if (currentUser) {
        useAuthStore.getState().setAuth(currentUser, newToken);
      }

      processQueue(newToken);
      isRefreshing = false;

      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);
    } catch {
      isRefreshing = false;
      pendingQueue = [];
      localStorage.removeItem('if-fleet-rt');
      useAuthStore.getState().clearAuth();
      window.location.href = '/login';
      return Promise.reject(error);
    }
  },
);
