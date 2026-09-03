// getAppEngine()은 Worker 생성을 포함해 비동기다. LocalStore(kv) 등 read-only 팩·룰셋 singleton
// (content.ts)으로 못 푸는 진짜 비동기 접근에만 이 훅을 쓴다. 엔진은 프로세스당 싱글턴이라
// staleTime을 무한대로 둬도 안전하다.
import { useQuery } from '@tanstack/react-query';
import { getAppEngine, type AppEngine } from './engine.js';

export function useEngine() {
  return useQuery<AppEngine>({
    queryKey: ['engine'] as const,
    queryFn: () => getAppEngine(),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
