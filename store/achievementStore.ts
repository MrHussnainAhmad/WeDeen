import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { api } from '@/services/http';

export type AchievementCategory = 'salah' | 'quran' | 'hafiz' | 'dhikr' | 'hadith' | 'devotion';
export type AchievementTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

export type Achievement = {
  id: string;
  title: string;
  description: string;
  category: AchievementCategory;
  tier: AchievementTier;
  targetValue: number;
  currentValue: number;
  isUnlocked: boolean;
  unlockedAt: number | null;
  imageAsset: string;
};

const INITIAL_ACHIEVEMENTS: Achievement[] = [
  // Salah Warrior
  { id: 'salah_1', title: 'First Step', description: 'Pray your first Salah via WeDeen', category: 'salah', tier: 'Bronze', targetValue: 1, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
  { id: 'salah_2', title: 'Five Pillars', description: 'Pray all 5 prayers in one day', category: 'salah', tier: 'Silver', targetValue: 1, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
  { id: 'salah_3', title: 'Week of Devotion', description: 'Pray all 5 prayers for 7 consecutive days', category: 'salah', tier: 'Gold', targetValue: 7, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
  { id: 'salah_4', title: 'Steadfast', description: 'Pray all 5 prayers for 30 consecutive days', category: 'salah', tier: 'Platinum', targetValue: 30, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
  { id: 'salah_5', title: 'Never Miss Fajr', description: 'Pray Fajr 7 days in a row', category: 'salah', tier: 'Silver', targetValue: 7, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
  { id: 'salah_6', title: 'Dawn Guardian', description: 'Pray Fajr 30 days in a row', category: 'salah', tier: 'Gold', targetValue: 30, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
  { id: 'salah_7', title: '100 Prayers', description: 'Pray 100 total prayers via WeDeen', category: 'salah', tier: 'Gold', targetValue: 100, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
  { id: 'salah_8', title: "Ummah's Pride", description: 'Pray 500 total prayers', category: 'salah', tier: 'Platinum', targetValue: 500, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },

  // Quran Journey
  { id: 'quran_1', title: 'First Ayah', description: 'Read your first Ayah', category: 'quran', tier: 'Bronze', targetValue: 1, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
  { id: 'quran_2', title: 'Al-Fatiha', description: 'Complete Surah Al-Fatiha', category: 'quran', tier: 'Bronze', targetValue: 7, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
  { id: 'quran_3', title: 'Surah Explorer', description: 'Read 10 different Surahs', category: 'quran', tier: 'Silver', targetValue: 10, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
  { id: 'quran_4', title: 'Half Way', description: 'Read 300 Ayahs total', category: 'quran', tier: 'Silver', targetValue: 300, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
  { id: 'quran_5', title: 'Quran Companion', description: 'Read 1000 Ayahs total', category: 'quran', tier: 'Gold', targetValue: 1000, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
  { id: 'quran_6', title: 'Khatm ul Quran', description: 'Read all 6236 Ayahs', category: 'quran', tier: 'Platinum', targetValue: 6236, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
  { id: 'quran_7', title: 'First Listen', description: 'Listen to your first Ayah audio', category: 'quran', tier: 'Bronze', targetValue: 1, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
  { id: 'quran_8', title: 'Melodic Heart', description: 'Listen to 5 complete Surahs', category: 'quran', tier: 'Silver', targetValue: 5, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
  { id: 'quran_9', title: 'Bookmarker', description: 'Favorite 10 Ayahs', category: 'quran', tier: 'Silver', targetValue: 10, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
  { id: 'quran_10', title: 'Searcher', description: 'Search Quran 20 times', category: 'quran', tier: 'Bronze', targetValue: 20, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },

  // Hafiz Path
  { id: 'hafiz_1', title: 'Memory Begins', description: 'Mark your first Surah as learnt', category: 'hafiz', tier: 'Bronze', targetValue: 1, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
  { id: 'hafiz_2', title: 'Short Surahs', description: 'Mark 10 Surahs as learnt', category: 'hafiz', tier: 'Silver', targetValue: 10, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
  { id: 'hafiz_3', title: 'Juz Amma', description: 'Mark all Surahs of Juz 30 as learnt', category: 'hafiz', tier: 'Gold', targetValue: 37, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
  { id: 'hafiz_4', title: 'Walking Quran', description: 'Mark 50 Surahs as learnt', category: 'hafiz', tier: 'Platinum', targetValue: 50, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
  { id: 'hafiz_5', title: 'Upcoming Hafiz', description: 'Mark 80 Surahs as learnt', category: 'hafiz', tier: 'Gold', targetValue: 80, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
  { id: 'hafiz_6', title: 'Destined to be Hafiz', description: 'Mark 100 Surahs as learnt', category: 'hafiz', tier: 'Gold', targetValue: 100, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
  { id: 'hafiz_7', title: 'Walahi i am done', description: 'Mark 110 Surahs as learnt', category: 'hafiz', tier: 'Platinum', targetValue: 110, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
  { id: 'hafiz_8', title: 'Hafiz', description: 'Mark 114 Surahs as learnt', category: 'hafiz', tier: 'Platinum', targetValue: 114, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },

  // Dhikr Master
  { id: 'dhikr_1', title: 'First Tasbih', description: 'Complete your first Tasbih set (100)', category: 'dhikr', tier: 'Bronze', targetValue: 100, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
  { id: 'dhikr_2', title: 'Consistent Heart', description: 'Complete Tasbih 7 days in a row', category: 'dhikr', tier: 'Silver', targetValue: 7, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
  { id: 'dhikr_3', title: '1000 Tasbihs', description: 'Reach 1000 total Tasbih taps', category: 'dhikr', tier: 'Silver', targetValue: 1000, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
  { id: 'dhikr_4', title: '10K Tasbihs', description: 'Reach 10,000 total Tasbih taps', category: 'dhikr', tier: 'Gold', targetValue: 10000, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
  { id: 'dhikr_5', title: 'Azkar Keeper', description: 'Read daily Azkar for 7 days in a row', category: 'dhikr', tier: 'Silver', targetValue: 7, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
  { id: 'dhikr_6', title: 'Morning Soul', description: 'Read Azkar for 30 days in a row', category: 'dhikr', tier: 'Gold', targetValue: 30, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
  { id: 'dhikr_7', title: 'Dua Companion', description: 'Read 25 duas or azkar from the library', category: 'dhikr', tier: 'Silver', targetValue: 25, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },

  // Knowledge Seeker
  { id: 'hadith_1', title: 'First Hadith', description: 'Read your first Hadith', category: 'hadith', tier: 'Bronze', targetValue: 1, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
  { id: 'hadith_2', title: 'Curious Mind', description: 'Read 50 Hadiths', category: 'hadith', tier: 'Silver', targetValue: 50, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
  { id: 'hadith_3', title: 'Scholar', description: 'Read 200 Hadiths', category: 'hadith', tier: 'Gold', targetValue: 200, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
  { id: 'hadith_4', title: 'Hadith Hunter', description: 'Search Hadith 20 times', category: 'hadith', tier: 'Bronze', targetValue: 20, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
  { id: 'hadith_5', title: 'Book Collector', description: 'Open all available Hadith books', category: 'hadith', tier: 'Silver', targetValue: 9, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },

  // Devotion
  { id: 'dev_1', title: 'Welcome', description: 'Open WeDeen for the first time', category: 'devotion', tier: 'Bronze', targetValue: 1, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
  { id: 'dev_2', title: 'Daily Visitor', description: 'Open app 7 days in a row', category: 'devotion', tier: 'Silver', targetValue: 7, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
  { id: 'dev_3', title: 'Faithful', description: 'Open app 30 days in a row', category: 'devotion', tier: 'Gold', targetValue: 30, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
  { id: 'dev_4', title: 'Qibla Finder', description: 'Use Qibla Compass 5 times', category: 'devotion', tier: 'Bronze', targetValue: 5, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
  { id: 'dev_5', title: 'Sharer', description: 'Share an Ayah or Hadith', category: 'devotion', tier: 'Bronze', targetValue: 1, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
  { id: 'dev_6', title: 'Spread the Word', description: 'Share 20 Ayahs or Hadiths', category: 'devotion', tier: 'Silver', targetValue: 20, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
  { id: 'dev_7', title: 'Night Reader', description: 'Read Quran between 11PM and 3AM', category: 'devotion', tier: 'Silver', targetValue: 5, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
  { id: 'dev_8', title: 'Ramadan Ready', description: 'Use app every day of Ramadan', category: 'devotion', tier: 'Platinum', targetValue: 30, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
  { id: 'dev_9', title: 'Zakat Ready', description: 'Create your first Zakat calculation', category: 'devotion', tier: 'Bronze', targetValue: 1, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
  { id: 'dev_10', title: 'Ten Fasts', description: 'Track 10 completed fasts', category: 'devotion', tier: 'Silver', targetValue: 10, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
  { id: 'dev_11', title: 'Taraweeh Builder', description: 'Track 80 Taraweeh rakats', category: 'devotion', tier: 'Gold', targetValue: 80, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
  { id: 'dev_12', title: 'Widget Master', description: 'Mark a prayer as completed directly from the widget', category: 'devotion', tier: 'Bronze', targetValue: 1, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
  { id: 'dev_13', title: 'Halal Explorer', description: 'Search for nearby Halal restaurants or Mosques', category: 'devotion', tier: 'Bronze', targetValue: 1, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
  { id: 'dev_14', title: 'Time Traveler', description: 'Convert a date using the Hijri Converter', category: 'devotion', tier: 'Bronze', targetValue: 1, currentValue: 0, isUnlocked: false, unlockedAt: null, imageAsset: '' },
];

export const XP_BY_TIER: Record<AchievementTier, number> = {
  Bronze: 10,
  Silver: 25,
  Gold: 50,
  Platinum: 100,
};

export function getRankTitle(xp: number): { title: string; icon: string } {
  if (xp >= 1000) return { title: 'Hafiz ul Ummah', icon: 'ribbon-outline' };
  if (xp >= 600) return { title: 'Enlightened', icon: 'bulb-outline' };
  if (xp >= 300) return { title: 'Devoted', icon: 'heart-half-outline' };
  if (xp >= 100) return { title: 'Believer', icon: 'heart-outline' };
  return { title: 'Seeker', icon: 'search-outline' };
}

export function getRankProgress(xp: number): { currentLevelXp: number; nextLevelXp: number; percentage: number } {
  if (xp >= 1000) return { currentLevelXp: 1000, nextLevelXp: 1000, percentage: 100 };
  if (xp >= 600) return { currentLevelXp: 600, nextLevelXp: 1000, percentage: Math.min(100, Math.round(((xp - 600) / 400) * 100)) };
  if (xp >= 300) return { currentLevelXp: 300, nextLevelXp: 600, percentage: Math.min(100, Math.round(((xp - 300) / 300) * 100)) };
  if (xp >= 100) return { currentLevelXp: 100, nextLevelXp: 300, percentage: Math.min(100, Math.round(((xp - 100) / 200) * 100)) };
  return { currentLevelXp: 0, nextLevelXp: 100, percentage: Math.min(100, Math.round((xp / 100) * 100)) };
}

type AchievementState = {
  achievements: Achievement[];
  currentUnlock: Achievement | null;
  hydrated: boolean;
  totalXp: number;
  rankTitle: string;
  rankIcon: string;
  rankProgress: { currentLevelXp: number; nextLevelXp: number; percentage: number };
  closeUnlockPopup: () => void;
  trackEvent: (eventType: string, value: number, extraMeta?: string) => Promise<void>;
  hydrateAchievements: (userId: string | null) => Promise<void>;
  syncWithBackend: (token: string, userId: string) => Promise<void>;
  resetAchievements: () => Promise<void>;
};

const CACHE_PREFIX = 'wedeen_achievements_v1_';
const SYNC_QUEUE_KEY = 'wedeen_achievements_sync_queue_v1_';

type AchievementSyncPayload = {
  achievementId: string;
  currentValue: number;
  isUnlocked: boolean;
  unlockedAt: number | null;
};

async function queueAchievementSync(userId: string, payload: AchievementSyncPayload) {
  const queueKey = `${SYNC_QUEUE_KEY}${userId}`;
  const queueRaw = await AsyncStorage.getItem(queueKey);
  let queue: AchievementSyncPayload[] = [];
  try {
    queue = queueRaw ? JSON.parse(queueRaw) : [];
  } catch {
    queue = [];
  }

  const byId = new Map(queue.map((item) => [item.achievementId, item]));
  const existing = byId.get(payload.achievementId);
  byId.set(payload.achievementId, {
    achievementId: payload.achievementId,
    currentValue: Math.max(existing?.currentValue ?? 0, payload.currentValue),
    isUnlocked: Boolean(existing?.isUnlocked || payload.isUnlocked),
    unlockedAt: existing?.unlockedAt ?? payload.unlockedAt ?? null,
  });

  await AsyncStorage.setItem(queueKey, JSON.stringify([...byId.values()]));
}

async function pushAchievementSync(token: string, userId: string, payload: AchievementSyncPayload) {
  try {
    await api.post('/sync/achievements', payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    await queueAchievementSync(userId, payload);
  }
}

export const useAchievementStore = create<AchievementState>((set, get) => ({
  achievements: INITIAL_ACHIEVEMENTS,
  currentUnlock: null,
  hydrated: false,
  totalXp: 0,
  rankTitle: 'Seeker',
  rankIcon: 'search-outline',
  rankProgress: getRankProgress(0),

  closeUnlockPopup: () => set({ currentUnlock: null }),

  hydrateAchievements: async (userId: string | null) => {
    const key = userId ? `${CACHE_PREFIX}${userId}` : `${CACHE_PREFIX}guest`;
    let cached = await AsyncStorage.getItem(key);
    let loaded = INITIAL_ACHIEVEMENTS;

    if (userId) {
      // Merge guest achievements to prevent double collection and retain guest progress
      const guestKey = `${CACHE_PREFIX}guest`;
      const guestCached = await AsyncStorage.getItem(guestKey);
      if (guestCached) {
        try {
          const guestParsed = JSON.parse(guestCached) as Achievement[];
          if (Array.isArray(guestParsed)) {
            let userLoaded = INITIAL_ACHIEVEMENTS;
            if (cached) {
              const userParsed = JSON.parse(cached) as Achievement[];
              if (Array.isArray(userParsed)) {
                userLoaded = INITIAL_ACHIEVEMENTS.map((initial) => {
                  const uItem = userParsed.find((p) => p.id === initial.id);
                  if (uItem) {
                    return {
                      ...initial,
                      currentValue: uItem.currentValue,
                      isUnlocked: uItem.isUnlocked,
                      unlockedAt: uItem.unlockedAt,
                    };
                  }
                  return initial;
                });
              }
            }

            loaded = userLoaded.map((userItem) => {
              const guestItem = guestParsed.find((g) => g.id === userItem.id);
              if (guestItem) {
                const mergedUnlocked = userItem.isUnlocked || guestItem.isUnlocked;
                const mergedValue = Math.max(userItem.currentValue, guestItem.currentValue);
                const mergedUnlockedAt = userItem.unlockedAt || guestItem.unlockedAt || null;
                return {
                  ...userItem,
                  currentValue: Math.min(mergedValue, userItem.targetValue),
                  isUnlocked: mergedUnlocked,
                  unlockedAt: mergedUnlockedAt,
                };
              }
              return userItem;
            });

            await AsyncStorage.setItem(key, JSON.stringify(loaded));
            await AsyncStorage.removeItem(guestKey);
            cached = JSON.stringify(loaded);
          }
        } catch (e) {
          console.error('Error merging guest achievements:', e);
        }
      }
    }

    if (cached) {
      try {
        const parsed = JSON.parse(cached) as Achievement[];
        if (Array.isArray(parsed)) {
          // Merge cached values into INITIAL_ACHIEVEMENTS to support schema updates
          loaded = INITIAL_ACHIEVEMENTS.map((initial) => {
            const cacheItem = parsed.find((p) => p.id === initial.id);
            if (cacheItem) {
              return {
                ...initial,
                currentValue: cacheItem.currentValue,
                isUnlocked: cacheItem.isUnlocked,
                unlockedAt: cacheItem.unlockedAt,
              };
            }
            return initial;
          });
        }
      } catch {
        // ignore
      }
    }

    let xp = 0;
    loaded.forEach((a) => {
      if (a.isUnlocked) {
        xp += XP_BY_TIER[a.tier];
      }
    });

    const rankInfo = getRankTitle(xp);

    set({
      achievements: loaded,
      totalXp: xp,
      rankTitle: rankInfo.title,
      rankIcon: rankInfo.icon,
      rankProgress: getRankProgress(xp),
      hydrated: true,
    });
  },

  resetAchievements: async () => {
    // Reset back to initial
    const fresh = INITIAL_ACHIEVEMENTS.map((a) => ({ ...a }));
    set({
      achievements: fresh,
      totalXp: 0,
      rankTitle: 'Seeker',
      rankIcon: 'search-outline',
      rankProgress: getRankProgress(0),
    });
  },

  trackEvent: async (eventType: string, value: number, extraMeta?: string) => {
    const { achievements, hydrated } = get();
    if (!hydrated) return;

    const { useAuthStore } = require('./authStore');
    const activeUserId = useAuthStore.getState()?.user?.id;
    if (!activeUserId) return; // Strict gating: No guest tracking

    let updated = false;
    let unlockedAchievement: any = null;

    const newAchievements = achievements.map((a) => {
      // 1. Determine if this achievement is concerned with the eventType
      let isTargetEvent = false;
      let newValue = a.currentValue;

      if (a.isUnlocked) return a; // Skip already unlocked

      if (a.id.startsWith('salah_') && eventType === 'salah') {
        isTargetEvent = true;
        if (a.id === 'salah_1') {
          // First Step: Pray first Salah
          newValue = a.currentValue + value;
        } else if (a.id === 'salah_7') {
          // 100 total
          newValue = a.currentValue + value;
        } else if (a.id === 'salah_8') {
          // 500 total
          newValue = a.currentValue + value;
        } else if (a.id === 'salah_2' && extraMeta === 'daily_full') {
          // 5 prayers in one day
          newValue = 1;
        } else if (a.id === 'salah_3' && extraMeta === 'salah_streak') {
          // 7-day streak
          newValue = Math.max(a.currentValue, value);
        } else if (a.id === 'salah_4' && extraMeta === 'salah_streak') {
          // 30-day streak
          newValue = Math.max(a.currentValue, value);
        } else if (a.id === 'salah_5' && extraMeta === 'fajr_streak') {
          // 7 Fajr streak
          newValue = Math.max(a.currentValue, value);
        } else if (a.id === 'salah_6' && extraMeta === 'fajr_streak') {
          // 30 Fajr streak
          newValue = Math.max(a.currentValue, value);
        }
      } else if (a.id.startsWith('quran_') && eventType.startsWith('quran_')) {
        if (a.id === 'quran_1' && eventType === 'quran_read') {
          isTargetEvent = true;
          newValue = a.currentValue + value;
        } else if (a.id === 'quran_2' && eventType === 'quran_surah_complete' && extraMeta === '1') {
          // Al-Fatiha
          isTargetEvent = true;
          newValue = 7; // Target achieved
        } else if (a.id === 'quran_3' && eventType === 'quran_surahs_unique') {
          isTargetEvent = true;
          newValue = value; // unique count passed directly
        } else if (a.id === 'quran_4' && eventType === 'quran_read') {
          isTargetEvent = true;
          newValue = a.currentValue + value;
        } else if (a.id === 'quran_5' && eventType === 'quran_read') {
          isTargetEvent = true;
          newValue = a.currentValue + value;
        } else if (a.id === 'quran_6' && eventType === 'quran_read') {
          isTargetEvent = true;
          newValue = a.currentValue + value;
        } else if (a.id === 'quran_7' && eventType === 'quran_listen') {
          isTargetEvent = true;
          newValue = a.currentValue + value;
        } else if (a.id === 'quran_8' && eventType === 'quran_surahs_listened') {
          isTargetEvent = true;
          newValue = a.currentValue + value;
        } else if (a.id === 'quran_9' && eventType === 'quran_favorite') {
          isTargetEvent = true;
          newValue = value; // total favorites count
        } else if (a.id === 'quran_10' && eventType === 'quran_search') {
          isTargetEvent = true;
          newValue = a.currentValue + value;
        }
      } else if (a.id.startsWith('hafiz_') && eventType === 'hafiz') {
        isTargetEvent = true;
        if (a.id === 'hafiz_1') {
          newValue = a.currentValue + value;
        } else if (a.id === 'hafiz_3' && extraMeta === 'juz30_complete') {
          newValue = 37;
        } else {
          newValue = value; // total memorized count (for hafiz_2, 4, 5, 6, 7, 8)
        }
      } else if (a.id.startsWith('dhikr_') && eventType.startsWith('dhikr_')) {
        if (a.id === 'dhikr_1' && eventType === 'dhikr_tasbih_set') {
          isTargetEvent = true;
          newValue = a.currentValue + value; // completed sets of 100
        } else if (a.id === 'dhikr_2' && eventType === 'dhikr_tasbih_streak') {
          isTargetEvent = true;
          newValue = Math.max(a.currentValue, value);
        } else if (a.id === 'dhikr_3' && eventType === 'dhikr_tap') {
          isTargetEvent = true;
          newValue = a.currentValue + value;
        } else if (a.id === 'dhikr_4' && eventType === 'dhikr_tap') {
          isTargetEvent = true;
          newValue = a.currentValue + value;
        } else if (a.id === 'dhikr_5' && eventType === 'dhikr_azkar_streak') {
          isTargetEvent = true;
          newValue = Math.max(a.currentValue, value);
        } else if (a.id === 'dhikr_6' && eventType === 'dhikr_azkar_streak') {
          isTargetEvent = true;
          newValue = Math.max(a.currentValue, value);
        } else if (a.id === 'dhikr_7' && eventType === 'dhikr_azkar_read') {
          isTargetEvent = true;
          newValue = a.currentValue + value;
        }
      } else if (a.id.startsWith('hadith_') && eventType.startsWith('hadith_')) {
        if (a.id === 'hadith_1' && eventType === 'hadith_read') {
          isTargetEvent = true;
          newValue = a.currentValue + value;
        } else if (a.id === 'hadith_2' && eventType === 'hadith_read') {
          isTargetEvent = true;
          newValue = a.currentValue + value;
        } else if (a.id === 'hadith_3' && eventType === 'hadith_read') {
          isTargetEvent = true;
          newValue = a.currentValue + value;
        } else if (a.id === 'hadith_4' && eventType === 'hadith_search') {
          isTargetEvent = true;
          newValue = a.currentValue + value;
        } else if (a.id === 'hadith_5' && eventType === 'hadith_books_opened') {
          isTargetEvent = true;
          newValue = value; // unique count
        }
      } else if (a.id.startsWith('dev_') && eventType.startsWith('dev_')) {
        if (a.id === 'dev_1' && eventType === 'dev_open') {
          isTargetEvent = true;
          newValue = a.currentValue + value;
        } else if (a.id === 'dev_2' && eventType === 'dev_streak') {
          isTargetEvent = true;
          newValue = Math.max(a.currentValue, value);
        } else if (a.id === 'dev_3' && eventType === 'dev_streak') {
          isTargetEvent = true;
          newValue = Math.max(a.currentValue, value);
        } else if (a.id === 'dev_4' && eventType === 'dev_qibla') {
          isTargetEvent = true;
          newValue = a.currentValue + value;
        } else if (a.id === 'dev_5' && eventType === 'dev_share') {
          isTargetEvent = true;
          newValue = a.currentValue + value;
        } else if (a.id === 'dev_6' && eventType === 'dev_share') {
          isTargetEvent = true;
          newValue = a.currentValue + value;
        } else if (a.id === 'dev_7' && eventType === 'dev_night_read') {
          isTargetEvent = true;
          newValue = a.currentValue + value;
        } else if (a.id === 'dev_8' && eventType === 'dev_ramadan_streak') {
          isTargetEvent = true;
          newValue = Math.max(a.currentValue, value);
        } else if (a.id === 'dev_9' && eventType === 'dev_zakat') {
          isTargetEvent = true;
          newValue = 1;
        } else if (a.id === 'dev_10' && eventType === 'dev_ramadan_fast') {
          isTargetEvent = true;
          newValue = a.currentValue + value;
        } else if (a.id === 'dev_11' && eventType === 'dev_taraweeh') {
          isTargetEvent = true;
          newValue = a.currentValue + value;
        } else if (a.id === 'dev_12' && eventType === 'dev_widget') {
          isTargetEvent = true;
          newValue = a.currentValue + value;
        } else if (a.id === 'dev_13' && eventType === 'dev_places') {
          isTargetEvent = true;
          newValue = a.currentValue + value;
        } else if (a.id === 'dev_14' && eventType === 'dev_hijri_convert') {
          isTargetEvent = true;
          newValue = a.currentValue + value;
        }
      }

      if (isTargetEvent && newValue !== a.currentValue) {
        updated = true;
        const reachedTarget = newValue >= a.targetValue;
        const unlocked = reachedTarget && !a.isUnlocked;
        
        const nextItem = {
          ...a,
          currentValue: Math.min(newValue, a.targetValue),
          isUnlocked: a.isUnlocked || unlocked,
          unlockedAt: unlocked ? Date.now() : a.unlockedAt,
        };

        if (unlocked) {
          unlockedAchievement = nextItem;
        }

        return nextItem;
      }

      return a;
    });

    if (updated) {
      // Recalculate XP and Rank
      let xp = 0;
      newAchievements.forEach((a) => {
        if (a.isUnlocked) {
          xp += XP_BY_TIER[a.tier];
        }
      });
      const rankInfo = getRankTitle(xp);

      set({
        achievements: newAchievements,
        totalXp: xp,
        rankTitle: rankInfo.title,
        rankIcon: rankInfo.icon,
        rankProgress: getRankProgress(xp),
      });

      const { useAuthStore } = require('./authStore'); // dynamically require to avoid circular dependency
      const activeUserId = useAuthStore.getState()?.user?.id;
      const token = useAuthStore.getState()?.token;
      const key = activeUserId ? `${CACHE_PREFIX}${activeUserId}` : `${CACHE_PREFIX}guest`;
      await AsyncStorage.setItem(key, JSON.stringify(newAchievements));

      if (unlockedAchievement) {
        // Set popup
        set({ currentUnlock: unlockedAchievement });

        // Trigger local notification
        Notifications.scheduleNotificationAsync({
          content: {
            title: 'Achievement Unlocked!',
            body: `${unlockedAchievement.title}: ${unlockedAchievement.description}`,
            sound: true,
          },
          trigger: null, // trigger immediately
        }).catch(() => undefined);

        if (activeUserId && token) {
          await pushAchievementSync(token, activeUserId, {
            achievementId: unlockedAchievement.id,
            currentValue: unlockedAchievement.currentValue,
            isUnlocked: true,
            unlockedAt: unlockedAchievement.unlockedAt,
          });
        }
      } else {
        if (activeUserId && token) {
          const targetAchievements = newAchievements.filter(na => {
            const old = achievements.find(o => o.id === na.id);
            return old && old.currentValue !== na.currentValue;
          });
          for (const item of targetAchievements) {
            await pushAchievementSync(token, activeUserId, {
              achievementId: item.id,
              currentValue: item.currentValue,
              isUnlocked: false,
              unlockedAt: null,
            });
          }
        }
      }
    }
  },

  syncWithBackend: async (token: string, userId: string) => {
    const queueKey = `${SYNC_QUEUE_KEY}${userId}`;
    try {
      // 1. Flush offline queue if any
      const queueRaw = await AsyncStorage.getItem(queueKey);
      if (queueRaw) {
        const queue = JSON.parse(queueRaw) as any[];
        if (Array.isArray(queue) && queue.length > 0) {
          for (const item of queue) {
            await api.post('/sync/achievements', item, {
              headers: { Authorization: `Bearer ${token}` }
            });
          }
          await AsyncStorage.removeItem(queueKey);
        }
      }

      // 2. Fetch all achievements from server to merge
      const { data } = await api.get<{ achievements: any[] }>('/sync/achievements', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (data && Array.isArray(data.achievements)) {
        const { achievements: current } = get();
        let changed = false;

        const merged = current.map((a) => {
          const serverItem = data.achievements.find((sa) => sa.achievementId === a.id);
          if (serverItem) {
            // Push local achievement if it is more advanced than the server
            const localHasMore = (a.isUnlocked && !serverItem.isUnlocked) || (a.currentValue > serverItem.currentValue);
            if (localHasMore) {
              pushAchievementSync(token, userId, {
                achievementId: a.id,
                currentValue: a.currentValue,
                isUnlocked: a.isUnlocked,
                unlockedAt: a.unlockedAt,
              }).catch(() => undefined);
            }

            const isUnlocked = a.isUnlocked || serverItem.isUnlocked;
            const currentValue = Math.max(a.currentValue, serverItem.currentValue);
            const unlockedAt = a.unlockedAt || serverItem.unlockedAt;

            if (isUnlocked !== a.isUnlocked || currentValue !== a.currentValue) {
              changed = true;
              return {
                ...a,
                isUnlocked,
                currentValue,
                unlockedAt,
              };
            }
          } else {
            // Push if the achievement is not on the server but we have progress locally
            if (a.isUnlocked || a.currentValue > 0) {
              pushAchievementSync(token, userId, {
                achievementId: a.id,
                currentValue: a.currentValue,
                isUnlocked: a.isUnlocked,
                unlockedAt: a.unlockedAt,
              }).catch(() => undefined);
            }
          }
          return a;
        });

        if (changed) {
          let xp = 0;
          merged.forEach((a) => {
            if (a.isUnlocked) xp += XP_BY_TIER[a.tier];
          });
          const rankInfo = getRankTitle(xp);

          set({
            achievements: merged,
            totalXp: xp,
            rankTitle: rankInfo.title,
            rankIcon: rankInfo.icon,
            rankProgress: getRankProgress(xp),
          });

          await AsyncStorage.setItem(`${CACHE_PREFIX}${userId}`, JSON.stringify(merged));
        }
      }
    } catch (err) {
      console.error('Failed to sync achievements with backend:', err);
    }
  },
}));

// Provide a legacy service wrapper
export const AchievementManager = {
  trackEvent: async (eventType: string, value: number, extraMeta?: string) => {
    await useAchievementStore.getState().trackEvent(eventType, value, extraMeta);
  },
  hydrate: async (userId: string | null) => {
    await useAchievementStore.getState().hydrateAchievements(userId);
  },
  sync: async (token: string, userId: string) => {
    await useAchievementStore.getState().syncWithBackend(token, userId);
  }
};
