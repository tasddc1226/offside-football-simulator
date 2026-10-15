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
import { startPush } from '../platform/push';
import { syncAdFree } from '../platform/adFree';
import { recoverIapItems } from '../platform/iapItems';
import { useColors, useIsDark } from '../theme/useColors';
import { useSnapshot } from 'valtio';
import { prefs } from '../store';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const c = useColors();
  const dark = useIsDark();
  // T-11-102 언어를 바꾸면 화면 전체를 다시 그린다(문구는 그릴 때 읽는다).
  const { lang } = useSnapshot(prefs);
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
    if (!show) return;
    startPush();
    void syncAdFree();
    void recoverIapItems();
  }, [show]);
  useEffect(() => {
    if (show) void SplashScreen.hideAsync();
  }, [show]);
  if (!show) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack
        key={lang}
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}
      />
    </GestureHandlerRootView>
  );
}
