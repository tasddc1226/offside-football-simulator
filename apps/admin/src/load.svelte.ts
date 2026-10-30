// T-11-577 화면이 열려 있는 동안만 API를 부른다. path가 바뀌거나(기간) tick이 늘면(새로고침) 다시 부르고, 늦게 온 옛 응답은 버린다.
import { get, type ApiResult } from './api.ts';

/** 로그인 · 권한 실패(401 · 403)는 칸마다 띄우지 않고 틀이 한 번 보인다. */
export const auth = $state({ denied: 0 });

export function loader<T>(path: () => string, tick: () => number) {
  const s = $state<{ r: ApiResult<T> | null }>({ r: null });
  $effect(() => {
    const p = path();
    tick();
    let live = true;
    s.r = null;
    void get<T>(p).then((r) => {
      if (!live) return;
      if (!r.ok && (r.status === 401 || r.status === 403)) auth.denied = r.status;
      s.r = r;
    });
    return () => {
      live = false;
    };
  });
  return s;
}
