import axios from 'axios';
import { router } from 'expo-router';
import { useAuthStore } from '../stores/auth.store';

const BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';

export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    // ngrok free tier shows an interstitial warning page for non-browser clients.
    // This header bypasses it so API calls reach the actual server.
    'ngrok-skip-browser-warning': 'true',
  },
  timeout: 10_000,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Refresh-token interceptor ─────────────────────────────────────────────────
// Mirrors the web app's refresh logic.  On a 401:
//   1. If a refresh is already in flight, queue the request and wait.
//   2. Otherwise POST /auth/refresh with the stored refreshToken.
//   3. On success: persist the new accessToken, replay all queued requests.
//   4. On failure: clear auth state and redirect to the login screen.

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config as typeof error.config & { _retry?: boolean };

    if (error?.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    const { refreshToken, clearAuth, setAccessToken } = useAuthStore.getState();

    // No refresh token stored — cannot recover; log out immediately.
    if (!refreshToken) {
      clearAuth();
      router.replace('/(auth)/login');
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Another refresh is already in progress — queue this request.
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      }).catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const { data } = await axios.post<{ accessToken: string }>(
        `${BASE_URL}/auth/refresh`,
        { refreshToken },
        {
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
        },
      );

      const newToken = data.accessToken;
      setAccessToken(newToken);
      processQueue(null, newToken);

      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      clearAuth();
      router.replace('/(auth)/login');
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);
