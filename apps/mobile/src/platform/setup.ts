// T-11-004 앱 시작 때 한 번: 엔진이 기대하는 전역(crypto.randomUUID)을 채우고 세이브 저장소를 MMKV로 정한다.
// 엔진(@offside/game)을 처음 부르기 전에 import돼야 한다 — 루트 _layout이 맨 먼저 불러온다.
import * as Crypto from 'expo-crypto';
import { createMMKV } from 'react-native-mmkv';
import { setStorage } from '@offside/game/storage';

const g = globalThis as { crypto?: { randomUUID?: () => string } };
g.crypto ??= {};
g.crypto.randomUUID ??= () => Crypto.randomUUID();

// 웹 세이브와 같은 키(ft_save·ft_hof …)를 그대로 쓴다. MMKV는 동기라 엔진의 저장 API에 바로 맞는다.
const kv = createMMKV({ id: 'offside' });
setStorage({
  getItem: (k) => kv.getString(k) ?? null,
  setItem: (k, v) => kv.set(k, v),
});
