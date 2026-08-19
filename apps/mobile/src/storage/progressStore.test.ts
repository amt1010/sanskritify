import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadProgress, saveProgress, MAX_HEARTS, type StoredProgress } from './progressStore';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('progressStore', () => {
  it('returns a default value when nothing is stored', async () => {
    const progress = await loadProgress();
    expect(progress.activityDays).toEqual([]);
    expect(progress.hearts.count).toBe(MAX_HEARTS);
    expect(typeof progress.hearts.updatedAt).toBe('number');
  });

  it('round-trips a saved value', async () => {
    const saved: StoredProgress = {
      hearts: { count: 3, updatedAt: 1_700_000_000_000 },
      activityDays: ['2026-08-15', '2026-08-16'],
    };
    await saveProgress(saved);
    expect(await loadProgress()).toEqual(saved);
  });

  it('persists across separate load calls', async () => {
    await saveProgress({ hearts: { count: 2, updatedAt: 1_700_000_000_000 }, activityDays: [] });
    const first = await loadProgress();
    const second = await loadProgress();
    expect(first).toEqual(second);
  });
});
