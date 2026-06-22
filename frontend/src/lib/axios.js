import axios from 'axios';
import { queryClient } from './queryClient';

const api = axios.create({
  baseURL: '/api',
  withCredentials: false,
  timeout: 30000,
});

let csrfToken = null;
function clearCsrf() {
  csrfToken = null;
}

if (typeof window !== 'undefined') {
  window.addEventListener('internops:auth', (e) => {
    if (e.detail?.type === 'logout') clearCsrf();
  });
}

async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  try {
    const res = await api.get('/auth/csrf-token');
    csrfToken = res.data.csrfToken;
  } catch {
    csrfToken = Math.random().toString(36).slice(2);
  }
  return csrfToken;
}

api.interceptors.request.use(async (config) => {
  const { default: useAuthStore } = await import('../store/auth');
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;

  const method = (config.method || 'get').toLowerCase();
  if (!['get', 'head', 'options'].includes(method)) {
    config.headers['X-CSRF-Token'] = await getCsrfToken();
  }
  return config;
});

// Single-flight refresh: many requests can 401 at once, only refresh once.
let refreshPromise = null;
async function tryRefresh() {
  if (!refreshPromise) {
    refreshPromise = axios
      .post('/api/auth/refresh', null, { withCredentials: true })
      .then((res) => {
        const newToken = res.data?.accessToken;
        if (newToken) {
          try {
            import('../store/auth').then(({ default: useAuthStore }) => {
              useAuthStore.getState().setAuth({ accessToken: newToken });
            });
          } catch {}
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('internops:auth', {
                detail: { type: 'refresh', accessToken: newToken },
              })
            );
          }
        }
        return newToken;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;

    if (err.response?.status === 401 && original && !original._retried) {
      original._retried = true;
      const newToken = await tryRefresh();
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
    }

    if (err.response?.status === 401) {
      clearCsrf();
      try {
        localStorage.removeItem('accessToken');
      } catch {}
      try {
        localStorage.removeItem('user');
      } catch {}
      queryClient.clear();
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export { clearCsrf };
export default api;
