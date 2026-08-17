import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

export default function RootLayout() {
  const [loaded] = useFonts({
    NotoDeva: require('../assets/fonts/NotoSansDevanagari-Regular.ttf'),
    'NotoDeva-Bold': require('../assets/fonts/NotoSansDevanagari-Bold.ttf'),
  });

  if (!loaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
