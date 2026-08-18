import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@sanskritify/progress/v1';
export const MAX_HEARTS = 5;

export interface StoredProgress {
  hearts: { count: number; updatedAt: number };
  activityDays: string[];
}

function defaultProgress(): StoredProgress {
  return { hearts: { count: MAX_HEARTS, updatedAt: Date.now() }, activityDays: [] };
}

export async function loadProgress(): Promise<StoredProgress> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (raw === null) return defaultProgress();
  return JSON.parse(raw) as StoredProgress;
}

export async function saveProgress(progress: StoredProgress): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}
