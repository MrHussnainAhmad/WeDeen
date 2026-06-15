import { create } from 'zustand';
import { me } from '@/services/authService';
import { clearToken, clearUser, getToken, getUser, saveToken, saveUser } from '@/utils/secure';
import type { User } from '@/types';

type AuthState = {
  token: string | null;
  user: User | null;
  hydrated: boolean;
  setAuth: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  hydrated: false,
  setAuth: async (token, user) => {
    await Promise.all([saveToken(token), saveUser(user)]);
    set({ token, user });
  },
  logout: async () => {
    await Promise.all([clearToken(), clearUser()]);
    set({ token: null, user: null });
  },
  // Restore the session optimistically: the cached token + user come straight
  // from local storage, so the logged-in UI shows instantly on launch (no wait
  // on the network). We then re-validate with the server in the background and
  // only sign out if the token is genuinely rejected (401/403) — a slow or
  // offline launch keeps the user signed in, like Instagram/Facebook.
  hydrate: async () => {
    const [token, cachedUser] = await Promise.all([getToken(), getUser()]);
    if (!token) {
      set({ token: null, user: null, hydrated: true });
      return;
    }

    // Show as logged in immediately from the cache.
    set({ token, user: cachedUser, hydrated: true });

    // Background re-validation + profile refresh.
    try {
      const profile = await me(token);
      // Bail if the user logged out while the request was in flight.
      if (get().token !== token) return;
      set({ user: profile.user });
      await saveUser(profile.user);
    } catch (err: any) {
      const status = err?.response?.status;
      // Only sign out when the server explicitly rejects the token. Network
      // errors / timeouts / 5xx (e.g. Vercel cold start) leave the cached
      // session intact.
      if (status === 401 || status === 403) {
        if (get().token !== token) return;
        await Promise.all([clearToken(), clearUser()]);
        set({ token: null, user: null });
      }
    }
  }
}));
