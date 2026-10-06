// T-11-004 앱 시작 때 한 번: 엔진이 기대하는 전역(crypto.randomUUID)을 채우고 세이브 저장소를 MMKV로 정한다.
// 엔진(@offside/game)을 처음 부르기 전에 import돼야 한다 — 루트 _layout이 맨 먼저 불러온다.
// T-11-005 서버 주소·인증(Bearer 토큰)과 라이브 소켓의 '화면이 보이는가'(AppState)도 여기서 넣는다.
import * as Crypto from 'expo-crypto';
import { AppState } from 'react-native';
import { createMMKV } from 'react-native-mmkv';
import { setStorage } from '@offside/game/storage';
import { configureApi } from '@offside/app-core/api/client';
import { configureLive } from '@offside/app-core/api/liveSocket';
import { API_BASE_URL } from './config';
import { authHeaders, renewSession } from './session';
import { bootLocale } from './locale';

const g = globalThis as { crypto?: { randomUUID?: () => string } };
g.crypto ??= {};
g.crypto.randomUUID ??= () => Crypto.randomUUID();

// 웹 세이브와 같은 키(ft_save·ft_hof …)를 그대로 쓴다. MMKV는 동기라 엔진의 저장 API에 바로 맞는다.
export const kv = createMMKV({ id: 'offside' });
setStorage({
  getItem: (k) => kv.getString(k) ?? null,
  setItem: (k, v) => kv.set(k, v),
});

// T-11-102 화면 문구 언어 — 저장소를 정한 뒤, 화면을 그리기 전에.
bootLocale();

configureApi({
  baseUrl: API_BASE_URL,
  auth: () => ({ credentials: 'omit', headers: authHeaders() }),
  renewSession,
});

configureLive({
  visible: () => AppState.currentState === 'active',
  watch: (fn) => {
    const sub = AppState.addEventListener('change', fn);
    return () => sub.remove();
  },
});
