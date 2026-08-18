import AsyncStorage from '@react-native-async-storage/async-storage';
import { render } from '@testing-library/react-native';
import Home from './index';
import { saveProgress } from '../src/storage/progressStore';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('Home', () => {
  it('shows no streak badge on a fresh install', async () => {
    const { queryByTestId } = await render(<Home />);
    expect(queryByTestId('streak')).toBeNull();
  });

  it('shows the streak badge once activity is recorded', async () => {
    const today = new Date().toISOString().slice(0, 10);
    await saveProgress({ hearts: { count: 5, updatedAt: Date.now() }, activityDays: [today] });
    const { getByTestId } = await render(<Home />);
    expect(getByTestId('streak').props.children).toContain('1');
  });
});
