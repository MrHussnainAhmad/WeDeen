import { create } from 'zustand';
import { me } from '@/services/authService';
import { clearToken, getToken, saveToken } from '@/utils/secure';
import type { User } from '@/types';

type AuthState = {
  token: string | null;
  user: User | null;
  hydrated: boolean;
  setAuth: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  hydrated: false,
  setAuth: async (token, user) => {
    await saveToken(token);
    set({ token, user });
  },
  logout: async () => {
    await clearToken();
    set({ token: null, user: null });
  },
  hydrate: async () => {
    const token = await getToken();
    if (!token) {
      set({ token: null, user: null, hydrated: true });
      return;
    }

    try {
      const profile = await me(token);
      set({ token, user: profile.user, hydrated: true });
    } catch {
      await clearToken();
      set({ token: null, user: null, hydrated: true });
    }
  }
}));
