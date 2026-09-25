// ───────── 모달 시트 상태 + 진행 연출 ─────────
// 시트 본문은 타입이 있는 뷰 모델(SheetView)로 표현하고, 실제 마크업은 ui/sheets/*.svelte가
// 그린다. 진행 연출(playSteps·playBlock·playJudge)은 반응형 뷰 상태를 원본과 같은 타이밍으로
// 갱신하는 async 함수라, 호출하는 쪽은 여전히 연출이 끝날 때까지 await 한다.
import { tick } from 'svelte';
import { clamp, ri } from '../game/rng.js';
import { clubsIn } from '../game/engine.js';
import type { GameState } from '../game/types.js';
import { motionOK } from './motion.js';
import type { SheetView, TickerRow } from './sheets/types.js';

export type SheetButton = { label: string; cls?: string; fn: () => void };
export type Chip = { label: string; d: number; money?: boolean; text?: string; bad?: boolean };
export type { SheetView } from './sheets/types.js';

export const sheetState = $state<{ open: boolean; busy: boolean; view: SheetView | null; buttons: SheetButton[] }>({
  open: false,
  busy: false,
  view: null,
  buttons: [],
});

let sheetEl: HTMLElement | null = null;
/** Sheet.svelte가 실제 시트 노드를 등록한다(열릴 때 스크롤·포커스 초기화용). */
export function registerSheetEl(el: HTMLElement | null) {
  sheetEl = el;
}

export function showSheet(view: SheetView, buttons: SheetButton[] = []) {
  sheetState.view = view;
  sheetState.buttons = buttons;
  sheetState.open = true;
  void tick().then(() => {
    if (sheetEl) sheetEl.scrollTop = 0;
    sheetEl?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
  });
}
export function closeSheet() {
  sheetState.open = false;
  sheetState.view = null;
  sheetState.buttons = [];
}

// ───────── 진행 연출 ─────────
// T-10-007: 진행 템포(단계·경기가 하나씩 나오는 간격)는 "정보를 읽는 시간"이라 감속 모션이어도
// 유지한다. 예전에는 감속 모션이면 0ms로 건너뛰어 결과가 한순간에 지나갔다. 감속 모션에서 빼는 것은
// 움직임(바늘 흔들기·CSS 등장 모션)뿐이다. 경기 중계는 건너뛰기 버튼으로 언제든 끝낼 수 있다.
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
// 템포 값(ms). 원래 값(단계 380·구간 2.6s)이 결과를 읽기엔 빠르다는 피드백으로 약 1.4배 늘렸다.
/** 프리시즌 단계·구간 뒤 부가 줄(컵 결과·A매치 소집 등) 하나가 머무는 시간. */
const STEP_MS = 520;
/** 한 구간(시즌 절반) 문자중계 총 길이 목표와 경기당 간격 범위. */
const BLOCK_TOTAL_MS = 3600;
const BLOCK_STEP_MIN = 120;
const BLOCK_STEP_MAX = 260;

export type MatchGame = { rd: number; res: 'W' | 'D' | 'L'; mins: number; g: number; a: number; rating: number; cs?: boolean; inj?: boolean };
function fakeScore(m: MatchGame): string {
  let gf = Math.max(m.g || 0, m.res === 'W' ? ri(1, 3) : ri(0, 2));
  let ga: number;
  if (m.res === 'W') ga = m.cs ? 0 : ri(0, gf - 1);
  else if (m.res === 'D') {
    if (m.cs) gf = 0;
    ga = gf;
  } else ga = gf + ri(1, 2);
  return `${gf}-${ga}`;
}

/** 단계 목록을 하나씩 켰다 끄며 진행률 막대를 채운다. */
export async function playSteps(title: string, steps: string[], ms = STEP_MS) {
  sheetState.busy = true;
  showSheet({ kind: 'steps', title, steps, active: -1, progress: 0 });
  const v = sheetState.view as Extract<SheetView, { kind: 'steps' }>;
  for (let i = 0; i < steps.length; i++) {
    v.active = i;
    v.progress = (i + 1) / steps.length;
    await wait(ms);
  }
  v.active = steps.length;
  await wait(150);
  sheetState.busy = false;
}

export interface BlockResultLike {
  games: MatchGame[];
  n: number;
  w: number;
  d: number;
  l: number;
  apps: number;
  goals: number;
  assists: number;
  cs: number;
  rs: number;
  hl: string[];
}
/** 구간 경기를 리포트의 경기별 기록 줄로 바꾼다(상대 팀 이름·스코어를 붙인다). */
export function matchRows(s: GameState, b: BlockResultLike): TickerRow[] {
  const opps = clubsIn(s.leagueId).filter((c) => c.id !== s.club.id);
  return b.games.map((m, i) => ({
    key: i,
    rd: m.rd,
    res: m.res,
    opp: opps.length ? opps[m.rd % opps.length]!.name : '상대 팀',
    score: fakeScore(m),
    mins: m.mins,
    g: m.g,
    a: m.a,
    rating: m.rating,
    inj: !!m.inj,
  }));
}

/**
 * T-10-028: 구간 경기를 한 경기씩 문자중계처럼 흘려보내며 승무패·출전 기록을 쌓는다(T-10-024에서 뺐던
 * 연출을 되살림). rows는 리포트와 같은 줄이라 스코어가 두 화면에서 같다. 건너뛰기를 누르면 즉시 끝난다.
 */
export function playBlock(
  head: { eyebrow: string; title: string; back: boolean; matches: number },
  b: BlockResultLike,
  rows: TickerRow[],
  extras: string[],
): Promise<void> {
  return new Promise((resolve) => {
    sheetState.busy = true;
    const n = rows.length,
      step = clamp(BLOCK_TOTAL_MS / Math.max(1, n), BLOCK_STEP_MIN, BLOCK_STEP_MAX);
    let timer: ReturnType<typeof setTimeout> | null = null,
      done = false,
      i = 0,
      rs = 0;
    const finish = async (skipped: boolean) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      v.skip = null;
      if (!skipped) {
        for (const t of extras) {
          v.extras.push({ text: t, done: false });
          await wait(STEP_MS);
          v.extras[v.extras.length - 1]!.done = true;
        }
        if (extras.length) await wait(200);
      }
      sheetState.busy = false;
      resolve();
    };
    showSheet({
      kind: 'block',
      eyebrow: head.eyebrow,
      title: head.title,
      back: head.back,
      progress: 0,
      round: '킥오프',
      wdl: { w: 0, d: 0, l: 0 },
      tally: { apps: 0, g: 0, a: 0, cs: 0, rating: '-' },
      ticker: [],
      extras: [],
      skip: () => void finish(true),
    });
    const v = sheetState.view as Extract<SheetView, { kind: 'block' }>;
    const tickOnce = () => {
      // 시트가 다른 내용으로 바뀌었거나 닫혔으면 건너뛴 것으로 끝낸다.
      if (sheetState.view !== v) return void finish(true);
      if (i >= n) return void finish(false);
      const m = b.games[i]!,
        row = rows[i]!;
      i++;
      v.wdl[m.res === 'W' ? 'w' : m.res === 'D' ? 'd' : 'l']++;
      if (m.mins) {
        v.tally.apps++;
        v.tally.g += m.g;
        v.tally.a += m.a;
        rs += m.rating;
        if (m.cs) v.tally.cs++;
        v.tally.rating = (rs / v.tally.apps).toFixed(2);
      }
      v.ticker.unshift(row);
      if (v.ticker.length > 5) v.ticker.length = 5;
      v.progress = i / n;
      v.round = `${m.rd}R / ${head.matches}R`;
      timer = setTimeout(tickOnce, step);
    };
    void tick().then(tickOnce);
  });
}

/** 성공 확률 막대 위에서 바늘이 흔들리다 실제 판정값(roll)에 멈춘다. */
export function playJudge(label: string, p: number, roll: number): Promise<void> {
  return new Promise((resolve) => {
    sheetState.busy = true;
    showSheet({ kind: 'judge', label, p, pos: 0 });
    const v = sheetState.view as Extract<SheetView, { kind: 'judge' }>;
    const dur = motionOK ? 1150 : 0,
      t0 = performance.now();
    const frame = () => {
      const t = dur ? Math.min(1, (performance.now() - t0) / dur) : 1,
        ease = 1 - Math.pow(1 - t, 3);
      const sweep = (Math.sin(t * 17) + 1) / 2;
      v.pos = sweep * (1 - ease) + roll * ease;
      if (t < 1) setTimeout(frame, 16);
      else
        setTimeout(() => {
          sheetState.busy = false;
          resolve();
          // 감속 모션이면 바늘이 흔들리지 않고 곧장 판정값에 서므로, 결과를 읽을 시간을 조금 더 준다.
        }, motionOK ? 280 : 700);
    };
    void tick().then(frame);
  });
}
