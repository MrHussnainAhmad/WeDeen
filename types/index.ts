export type User = {
  id: string;
  name: string;
  email: string;
  unlockedSurah?: number;
  createdAt: string;
};

export type AuthResponse = {
  token: string;
  user: User;
};

export type MemorizationItem = {
  _id?: string;
  userId?: string;
  surahNumber: number;
  ayahNumber: number;
  memorized: boolean;
  lastReviewed?: string | null;
  nextReview?: string | null;
};

export type LearningProgress = {
  unlockedSurah: number;
};
