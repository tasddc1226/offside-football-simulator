import { useColorScheme } from 'react-native';
import { DARK, LIGHT, type Colors } from './colors';

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? DARK : LIGHT;
}
