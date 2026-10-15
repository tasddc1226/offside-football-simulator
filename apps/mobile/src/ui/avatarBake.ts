// T-11-270 선수 그림 굽기 대기열. 그림 계획(JSON)이 키이고, AvatarBaker가 하나씩 찍어 파일 주소를 채운다.
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { releaseCapture } from 'react-native-view-shot';
import type { AvatarImagePlan } from '@offside/game/avatar-image';

export type BakeJob = { key: string; plan: AvatarImagePlan };
/** 구운 그림 파일. 한 화면의 선수 수보다 넉넉하게 두고, 넘치면 오래 안 쓴 것부터 지운다. */
const MAX = 200;
const done = new Map<string, string>();
const failed = new Set<string>();
/** 굽기를 기다리는 그림과, 그 그림을 기다리는 화면 수. 화면이 다 닫히면 굽지 않는다. */
const waiting = new Map<string, { plan: AvatarImagePlan; users: number }>();
const subs = new Set<() => void>();
let version = 0;
const emit = () => {
  version++;
  for (const f of subs) f();
};
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};
const snapshot = () => version;

function want(key: string, plan: AvatarImagePlan) {
  if (done.has(key) || failed.has(key)) return () => {};
  const w = waiting.get(key);
  if (w) w.users++;
  else {
    waiting.set(key, { plan, users: 1 });
    emit();
  }
  return () => {
    const cur = waiting.get(key);
    if (cur && --cur.users <= 0) waiting.delete(key);
  };
}

/** 구운 그림 주소. 아직이면 대기열에 올린다. 실패하면 failed(층을 직접 그린다). */
export function useBakedAvatar(plan: AvatarImagePlan): { uri?: string; failed: boolean } {
  const key = useMemo(() => JSON.stringify(plan), [plan]);
  // 값을 스토어 구독 결과로 받는다(React Compiler가 렌더 중 Map 읽기를 key로만 메모하지 않게).
  const uri = useSyncExternalStore(subscribe, () => done.get(key));
  const isFailed = useSyncExternalStore(subscribe, () => failed.has(key));
  useEffect(() => want(key, plan), [key, plan]);
  useEffect(() => {
    // 최근에 쓴 것으로 옮긴다.
    const cur = done.get(key);
    if (cur) {
      done.delete(key);
      done.set(key, cur);
    }
  }, [key, uri]);
  return uri ? { uri, failed: false } : { failed: isFailed };
}

/** 굽는 곳: 기다리는 그림이 생기면 알린다. */
export const useBakeQueue = () => useSyncExternalStore(subscribe, snapshot);
export function nextBake(): BakeJob | undefined {
  const first = waiting.entries().next();
  if (first.done) return undefined;
  const [key, { plan }] = first.value;
  return { key, plan };
}
export function finishBake(key: string, uri: string | undefined) {
  waiting.delete(key);
  if (uri) {
    done.set(key, uri);
    while (done.size > MAX) {
      const [old, file] = done.entries().next().value!;
      done.delete(old);
      releaseCapture(file);
    }
  } else failed.add(key);
  emit();
}
