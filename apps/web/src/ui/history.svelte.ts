// ───────── 브라우저 뒤로 가기 ↔ 앱 화면 (T-10-114) ─────────
// 앱은 주소를 바꾸지 않고 appState로 화면을 그린다. 그래서 모바일에서 왼쪽 끝을 밀거나(iOS) 뒤로 가기를 누르면
// (Android) 앱 밖으로 나가 버렸다. 화면이 바뀔 때마다 방문 기록을 하나 쌓고(주소는 그대로), 뒤로·앞으로 가면 그
// 기록의 화면을 되살린다. 기록하는 단위는 화면(appState.screen)과 그 안의 한 단계 — 선수 생성 1·2단계, 소식 목록·글,
// 선수 상세 — 까지다. 게임 탭·기록실 페이지는 기록하지 않는다.
// 이미 시작한 커리어의 생성 화면, 끝난(은퇴한) 커리어의 게임 화면으로는 돌아가지 않고 홈을 연다 — 뒤로 가서 같은
// 후보로 다시 시작하거나 끝난 게임을 여는 일을 막는다. 게임 중 뒤로 가면 홈(시트는 닫고, 남은 이벤트·결산은
// '이어하기'가 다시 연다)으로 나간다 — 게임 화면의 홈 버튼과 같다.
// T-11-213 하단 탭은 각자 맨 아래 기록이다(rootHere) — 탭끼리는 뒤로 가기로 넘어가지 않고, 탭 안에서 들어간 화면만
// 쌓인다. 이미 지나온 화면으로 가면 브라우저 기록도 거기까지 되돌린다(history.go) — 버린 앞쪽 기록은 앞으로 가기로도
// 열리지 않는다.
import { untrack } from 'svelte';
import {
  navKey,
  navRestore,
  navSnapshot,
  navStep,
  type NavEntry,
} from '@offside/app-core/navHistory';
import { closeSheet } from './sheetState.svelte.js';
import { appState } from './state.svelte.js';

type Entry = NavEntry;

/** 이 탭에서 쌓은 기록 — 새로 고침 전의 기록(sid가 다르다)은 모른다. */
const sid = Math.random().toString(36).slice(2);
const entries: Entry[] = [];
let cur = 0;
/** history.go로 옮겨 가는 기록 번호 — 그 popstate는 화면을 되살리지 않는다(화면은 이미 바뀌었다). */
let moving: number | null = null;

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

/**
 * 화면이 다 그려질 때까지(지연 로딩·목록 조회) 기다리며 스크롤을 되돌린다. T-11-406 컵 화면처럼 조회가 0.5초를 넘으면
 * 30프레임 안에 자리가 생기지 않아 맨 위에 남았다 — 4초쯤(240프레임)까지 기다리고, 그 사이 손으로 움직이면 멈춘다.
 */
const SCROLL_EVENTS = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
let scrollBackId = 0;
function scrollBack(y: number, tries = 240) {
  const id = ++scrollBackId;
  const quit = () => void (scrollBackId === id && scrollBackId++);
  const done = () => SCROLL_EVENTS.forEach((ev) => removeEventListener(ev, quit));
  SCROLL_EVENTS.forEach((ev) => addEventListener(ev, quit, { passive: true }));
  const step = (left: number) =>
    requestAnimationFrame(() => {
      if (scrollBackId !== id) return done();
      window.scrollTo(0, y);
      if (Math.abs(window.scrollY - y) > 2 && left > 0) step(left - 1);
      else done();
    });
  step(tries);
}

/** 브라우저 기록을 i번으로 옮긴다(화면은 그대로). */
function moveTo(i: number) {
  if (i === cur) return;
  const d = i - cur;
  cur = i;
  moving = i;
  history.go(d);
}

/** 지금 화면을 기록에 맞춘다 — 같으면 그대로, 지나온 화면이면 거기까지 되돌리고, 처음 보는 화면이면 쌓는다. */
function sync() {
  if (moving !== null) return; // 옮기는 중 — 도착하면 다시 본다.
  const step = navStep(
    entries.map((e) => e.key),
    cur,
    keyOf(),
  );
  if (step === null) return;
  if (step === 'push') {
    entries.length = cur + 1;
    entries.push(snapshot());
    cur = entries.length - 1;
    history.pushState({ sid, i: cur }, '');
    return;
  }
  entries.length = step + 1;
  entries[step] = snapshot();
  moveTo(step);
}

/** T-11-213 하단 탭으로 옮겼다 — 지금 화면을 맨 아래 기록 하나로 둔다. */
export function rootHere() {
  if (moving !== null) return;
  entries.length = 1;
  entries[0] = snapshot();
  if (cur === 0) history.replaceState({ sid, i: 0 }, '');
  else moveTo(0);
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
    if (st?.sid === sid && typeof st.i === 'number') {
      if (moving !== null) {
        // 우리가 옮긴 기록에 도착했다. 그 사이 바뀐 화면이 있으면 이제 맞춘다.
        if (st.i === moving) {
          moving = null;
          sync();
        }
        return;
      }
      if (!entries[st.i]) {
        // 탭 이동·되돌리기로 버린 앞쪽 기록 — 지금 기록으로 돌아간다.
        moving = cur;
        history.go(cur - st.i);
        return;
      }
      setPopDir(st.i < cur ? -1 : 1, ua);
      cur = st.i;
      restore(entries[cur]!);
      // 돌아갈 수 없어 홈으로 바뀌었는데 아래에 홈 기록이 있으면 거기까지 접는다.
      const at = entries.findIndex((x) => x.key === entries[cur]!.key);
      if (at < cur) {
        entries[at] = entries[cur]!;
        entries.length = at + 1;
        moveTo(at);
      }
      return;
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
      keyOf();
      untrack(sync);
    });
  });
}
