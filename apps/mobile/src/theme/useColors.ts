import { useColorScheme } from 'react-native';
import { useSnapshot } from 'valtio';
import { prefs } from '../store';
import { DARK, LIGHT, type Colors } from './colors';

/** 설정에서 고른 테마(prefs.theme), 고르지 않았으면 시스템 설정. */
export function useIsDark(): boolean {
  const { theme } = useSnapshot(prefs);
  const sys = useColorScheme();
  return theme ? theme === 'dark' : sys === 'dark';
}

export function useColors(): Colors {
  return useIsDark() ? DARK : LIGHT;
}
