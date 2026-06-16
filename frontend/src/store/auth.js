import { create } from 'zustand';
import { queryClient } from '../lib/queryClient';

// Hydrate from localStorage so a refresh keeps the session.
function readUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
}

const useAuthStore = create((set, get) => ({
  accessToken: localStorage.getItem('accessToken') || null,
  user: readUser(),

  setAuth: ({ accessToken, user }) => {
    if (accessToken) {
      localStorage.setItem('accessToken', accessToken);
      if (typeof window !== 'undefined') {
        // Notify the realtime layer to (re)connect with the new token.
        // Kept as a window event to avoid a circular import into the store.
        window.dispatchEvent(
          new CustomEvent('internops:auth', {
            detail: { type: 'login', accessToken },
          })
        );
      }
    }
    if (user !== undefined) {
      if (user) localStorage.setItem('user', JSON.stringify(user));
      else localStorage.removeItem('user');
    }
    set((s) => ({
      accessToken: accessToken ?? s.accessToken,
      user: user !== undefined ? user : s.user,
    }));
  },

  // Patch a single user field (e.g. updated name from /users/me refetch).
  patchUser: (patch) => {
    const next = { ...(get().user || {}), ...patch };
    localStorage.setItem('user', JSON.stringify(next));
    set({ user: next });
  },

  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    // Drop every cached query so the next login fetches fresh data, and
    // broadcast a "logout" event so axios + the websocket layer can
    // clear their own state (CSRF, in-flight requests) without us
    // creating a circular import.
    queryClient.clear();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('internops:auth', { detail: { type: 'logout' } })
      );
    }
    set({ accessToken: null, user: null });
  },
}));

export default useAuthStore;
