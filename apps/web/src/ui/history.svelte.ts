// ───────── 브라우저 뒤로 가기 ↔ 앱 화면 (T-10-114) ─────────
// 앱은 주소를 바꾸지 않고 appState로 화면을 그린다. 그래서 모바일에서 왼쪽 끝을 밀거나(iOS) 뒤로 가기를 누르면
// (Android) 앱 밖으로 나가 버렸다. 화면이 바뀔 때마다 방문 기록을 하나 쌓고(주소는 그대로), 뒤로·앞으로 가면 그
// 기록의 화면을 되살린다. 기록하는 단위는 화면(appState.screen)과 그 안의 한 단계 — 선수 생성 1·2단계, 소식 목록·글,
// 선수 상세 — 까지다. 게임 탭·기록실 페이지는 기록하지 않는다.
// 이미 시작한 커리어의 생성 화면, 끝난(은퇴한) 커리어의 게임 화면으로는 돌아가지 않고 홈을 연다 — 뒤로 가서 같은
// 후보로 다시 시작하거나 끝난 게임을 여는 일을 막는다. 게임 중 뒤로 가면 홈(시트는 닫고, 남은 이벤트·결산은
// '이어하기'가 다시 연다)으로 나간다 — 게임 화면의 홈 버튼과 같다.
import { untrack } from 'svelte';
import { navKey, navRestore, navSnapshot, type NavEntry } from '@offside/app-core/navHistory';
import { closeSheet } from './sheetState.svelte.js';
import { appState } from './state.svelte.js';

type Entry = NavEntry;

/** 이 탭에서 쌓은 기록 — 새로 고침 전의 기록(sid가 다르다)은 모른다. */
const sid = Math.random().toString(36).slice(2);
const entries: Entry[] = [];
let cur = 0;

// T-10-119 뒤로(-1)·앞으로(1) 가서 바뀐 화면인지 — App의 화면 전환 방향. null은 뒤로·앞으로 가기가 아니고,
// 0은 브라우저가 이미 넘김 효과를 보여 준 경우다(iOS 가장자리 밀기 등) — 앱 효과까지 겹치면 두 번 넘어간다.
// 화면이 안 바뀐 복원(소식 글 등)이면 다음 프레임에 지워 다음 화면 이동에 새지 않게 한다.
let popDir: -1 | 0 | 1 | null = null;
let swiped = false;
export const takePopDir = () => {
  const d = popDir;
  popDir = null;
  return d;
};
/** 지금 화면 변화가 브라우저 넘김 효과가 있었던 뒤로·앞으로 가기인지(화면 안 전환 — 소식 글 — 용). */
export const uaSwiped = () => swiped;
function setPopDir(d: -1 | 1, ua: boolean) {
  popDir = ua ? 0 : d;
  swiped = ua;
  requestAnimationFrame(() => ((popDir = null), (swiped = false)));
}
// 가장자리에서 시작한 터치 — hasUAVisualTransition을 모르는 브라우저에서 밀어서 뒤로 간 것으로 본다.
let edgeTouchAt = -Infinity;
const EDGE_PX = 30;

const keyOf = () => navKey(appState);
const snapshot = (): Entry => navSnapshot(appState, window.scrollY);

function restore(e: Entry) {
  closeSheet();
  const screen = navRestore(appState, e);
  // 되살린 상태를 이 기록의 값으로 삼는다(홈으로 돌렸으면 홈) — 아래 $effect가 새 기록을 쌓지 않는다.
  entries[cur] = { ...snapshot(), y: screen === e.screen ? e.y : 0 };
  scrollBack(entries[cur]!.y);
}

/** 화면이 다 그려질 때까지(지연 로딩·목록 조회) 몇 프레임 기다리며 스크롤을 되돌린다. */
function scrollBack(y: number, tries = 30) {
  requestAnimationFrame(() => {
    window.scrollTo(0, y);
    if (Math.abs(window.scrollY - y) > 2 && tries > 0) scrollBack(y, tries - 1);
  });
}

/** T-10-130 화면 아래 '← 이전으로'(BackBar): 이 탭에서 쌓은 이전 기록이 있으면 브라우저 뒤로 가기와 똑같이, 없으면 fallback. */
export function goBack(fallback: () => void) {
  if (cur > 0) history.back();
  else fallback();
}

export function initHistory() {
  try {
    history.scrollRestoration = 'manual';
  } catch {
    /* no-op */
  }
  entries.push(snapshot());
  history.replaceState({ sid, i: 0 }, '');

  let ticking = false;
  addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const e = entries[cur];
        if (e) e.y = window.scrollY;
      });
    },
    { passive: true },
  );

  addEventListener(
    'touchstart',
    (e) => {
      const x = e.touches[0]?.clientX;
      if (x != null && (x < EDGE_PX || x > innerWidth - EDGE_PX)) edgeTouchAt = performance.now();
    },
    { passive: true },
  );

  addEventListener('popstate', (ev) => {
    const ua =
      (ev as PopStateEvent & { hasUAVisualTransition?: boolean }).hasUAVisualTransition === true ||
      performance.now() - edgeTouchAt < 1500;
    const st = ev.state as { sid?: string; i?: number } | null;
    if (st?.sid === sid && typeof st.i === 'number' && entries[st.i]) {
      setPopDir(st.i < cur ? -1 : 1, ua);
      cur = st.i;
      return restore(entries[cur]!);
    }
    // 새로 고침 전 기록이나 다른 코드가 지운 기록 — 홈에서 새로 쌓는다.
    setPopDir(-1, ua);
    entries.length = 0;
    cur = 0;
    entries.push({ ...snapshot(), key: '' });
    restore({ ...entries[0]!, screen: 'home' });
    history.replaceState({ sid, i: 0 }, '');
  });

  $effect.root(() => {
    $effect(() => {
      const key = keyOf();
      untrack(() => {
        if (key === entries[cur]?.key) return;
        entries.length = cur + 1;
        entries.push(snapshot());
        cur = entries.length - 1;
        history.pushState({ sid, i: cur }, '');
      });
    });
  });
}
