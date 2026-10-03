import '../platform/setup';
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  BarlowCondensed_400Regular,
  BarlowCondensed_500Medium,
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
  BarlowCondensed_800ExtraBold,
} from '@expo-google-fonts/barlow-condensed';
import { boot } from '../game/boot';
import { useColors, useIsDark } from '../theme/useColors';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const c = useColors();
  const dark = useIsDark();
  const [fonts] = useFonts({
    BarlowCondensed_400Regular,
    BarlowCondensed_500Medium,
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
    BarlowCondensed_800ExtraBold,
  });
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void boot().finally(() => setReady(true));
  }, []);
  const show = ready && fonts;
  useEffect(() => {
    if (show) void SplashScreen.hideAsync();
  }, [show]);
  if (!show) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }} />
    </GestureHandlerRootView>
  );
}
