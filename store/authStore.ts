import { create } from 'zustand';
import { me } from '@/services/authService';
import { syncMemorizationQueueThrottled, cacheLearningProgress } from '@/services/memorizationService';
import { syncSalahQueue, restoreSalahHistory } from '@/services/prayerTrackerService';
import { syncTasbihQueue, restoreTasbihHistory } from '@/services/tasbihService';
import { syncFavorites, restoreFavorites } from '@/services/favoriteAyahService';
import { restoreDuaProgress, syncDuaProgress } from '@/services/duaLibraryService';
import { restoreFastingLogs, syncFastingLogs } from '@/services/ramadanService';
import { restoreFavoritePlaces, syncFavoritePlaces } from '@/services/placesService';
import { restoreZakatHistory, syncZakatHistory } from '@/services/zakatService';
import { restoreReflections } from '@/services/reflectionService';
import { useAchievementStore } from '@/store/achievementStore';
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
    if (user.unlockedSurah) {
      cacheLearningProgress(user.id, {
        unlockedSurah: Math.max(1, Math.min(114, user.unlockedSurah)),
      }).catch(() => undefined);
    }
    syncMemorizationQueueThrottled(token, user.id, { force: true }).catch(() => undefined);
    
    // Background sync other services
    syncSalahQueue(token, user.id).then(() => restoreSalahHistory(token)).catch(() => undefined);
    syncTasbihQueue(token, user.id).then(() => restoreTasbihHistory(token)).catch(() => undefined);
    syncFavorites(token).then(() => restoreFavorites(token)).catch(() => undefined);
    syncZakatHistory(token).then(() => restoreZakatHistory(token)).catch(() => undefined);
    syncFastingLogs(token).then(() => restoreFastingLogs(token)).catch(() => undefined);
    syncFavoritePlaces(token).then(() => restoreFavoritePlaces(token)).catch(() => undefined);
    syncDuaProgress(token).then(() => restoreDuaProgress(token)).catch(() => undefined);
    restoreReflections(token).catch(() => undefined);
    
    const achStore = useAchievementStore.getState();
    achStore.hydrateAchievements(user.id).then(() => achStore.syncWithBackend(token, user.id)).catch(() => undefined);
  },
  logout: async () => {
    await Promise.all([clearToken(), clearUser()]);
    set({ token: null, user: null });
    useAchievementStore.getState().resetAchievements().catch(() => undefined);
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
      if (profile.user.unlockedSurah) {
        cacheLearningProgress(profile.user.id, {
          unlockedSurah: Math.max(1, Math.min(114, profile.user.unlockedSurah)),
        }).catch(() => undefined);
      }
      syncMemorizationQueueThrottled(token, profile.user.id, { force: true }).catch(() => undefined);
      
      syncSalahQueue(token, profile.user.id).then(() => restoreSalahHistory(token)).catch(() => undefined);
      syncTasbihQueue(token, profile.user.id).then(() => restoreTasbihHistory(token)).catch(() => undefined);
      syncFavorites(token).then(() => restoreFavorites(token)).catch(() => undefined);
      syncZakatHistory(token).then(() => restoreZakatHistory(token)).catch(() => undefined);
      syncFastingLogs(token).then(() => restoreFastingLogs(token)).catch(() => undefined);
      syncFavoritePlaces(token).then(() => restoreFavoritePlaces(token)).catch(() => undefined);
      syncDuaProgress(token).then(() => restoreDuaProgress(token)).catch(() => undefined);
      restoreReflections(token).catch(() => undefined);
      useAchievementStore.getState().syncWithBackend(token, profile.user.id).catch(() => undefined);
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
