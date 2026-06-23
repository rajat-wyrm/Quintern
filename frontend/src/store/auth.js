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

const useAuthStore = create((set) => ({
  accessToken: null,   // memory only — never persisted
  user: null,
  setAuth: (token, user) => set({ accessToken: token, user }),
  clearAuth: () => set({ accessToken: null, user: null }),


  // Patch a single user field (e.g. updated name from /users/me refetch).
  patchUser: (patch) => {
    const next = { ...(get().user || {}), ...patch };
    localStorage.setItem('user', JSON.stringify(next));
    set({ user: next });
  },

  logout: () => {
    
    if (typeof window !== 'undefined') {
  localStorage.removeItem('user');
}
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
