import { create } from 'zustand';

interface AudioState {
  isPlaying: boolean;
  isActive: boolean; // true if any audio is currently loaded/playing
  title: string | null; // e.g. "Surah Al-Fatihah"
  subtitle: string | null; // e.g. "Mishary Rashid Alafasy"
  surahNumber: number | null;
  setAudioState: (state: Partial<AudioState>) => void;
  clearAudioState: () => void;
}

export const useAudioStore = create<AudioState>((set) => ({
  isPlaying: false,
  isActive: false,
  title: null,
  subtitle: null,
  surahNumber: null,
  setAudioState: (state) => set((prev) => ({ ...prev, ...state })),
  clearAudioState: () =>
    set({ isPlaying: false, isActive: false, title: null, subtitle: null, surahNumber: null }),
}));
