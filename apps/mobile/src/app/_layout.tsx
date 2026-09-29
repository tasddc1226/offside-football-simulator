import '../platform/setup';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColors } from '../theme/useColors';

export default function RootLayout() {
  const c = useColors();
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }} />
    </>
  );
}
