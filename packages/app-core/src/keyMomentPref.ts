// T-11-426 결정적 장면(T-11-390) 켜기 · 끄기 설정. 이 기기에만 저장하고(세이브가 아니다) 기본은 켬이다.
// 끄면 구간 진행(game-actions advance)이 장면을 열지 않는다 — 결과는 감독에게 맡겼을 때와 같다.
// 설정 화면이 같이 불러오므로 장면 판정(keyMoments.ts)과 떼어 둔다.
import { loadKey, saveKey } from '@offside/game/storage';

export const KEY_MOMENTS_KEY = 'ft_key_moments';
export const keyMomentsOn = (): boolean => loadKey<boolean>(KEY_MOMENTS_KEY) !== false;
export const setKeyMomentsOn = (on: boolean) => saveKey(KEY_MOMENTS_KEY, on);
