// ───────── 모달 시트 (ui.ts 416~581줄 포트) ─────────
// 이벤트/이적시장/진행 연출(playSteps·playBlock·playJudge)은 프레임 단위 타이밍과 DOM 클래스
// 토글에 크게 의존하는 명령형 연출이라, Svelte 선언형 템플릿으로 옮기면 타이밍이나 스킵 동작이
// 미묘하게 달라질 위험이 크다. 원본과 동일하게 시트 DOM 노드를 직접 조작하는 방식을 유지하고,
// 반응형 상태(모달 표시 여부 · 버튼 목록)만 Svelte runes로 노출해 Sheet.svelte가 마운트를 맡는다.
import { clamp, ri } from '../game/rng.js';
import { clubsIn, fmtMoney, leagueOf, roundRange } from '../game/engine.js';
import { PHASES } from '../game/data.js';
import { esc } from '../game/dom.js';
import type { GameState } from '../game/types.js';

export type SheetButton = { label: string; cls?: string; fn: () => void };
export type Chip = { label: string; d: number; money?: boolean; text?: string; bad?: boolean };

export const sheetState = $state<{ open: boolean; html: string; buttons: SheetButton[] }>({
  open: false,
  html: '',
  buttons: [],
});

export let busyAnim = false;
function setBusy(v: boolean) {
  busyAnim = v;
}

let sheetEl: HTMLElement | null = null;
/** Sheet.svelte가 마운트될 때 실제 시트 DOM 노드를 등록한다(playSteps/playBlock/playJudge가 직접 쓴다). */
export function registerSheetEl(el: HTMLElement | null) {
  sheetEl = el;
}
/** 이벤트 선택지(data-choice)·이적시장 옵션(data-opt) 클릭 위임을 붙이기 위해 실제 시트 노드를 준다. */
export function getSheetEl(): HTMLElement | null {
  return sheetEl;
}
const qOne = <T extends Element = Element>(sel: string): T | null => (sheetEl ? sheetEl.querySelector<T>(sel) : null);
const qAll = <T extends Element = Element>(sel: string): T[] => (sheetEl ? [...sheetEl.querySelectorAll<T>(sel)] : []);

export function openSheet(html: string) {
  sheetState.html = html;
  sheetState.buttons = [];
  sheetState.open = true;
  queueMicrotask(() => {
    if (sheetEl) sheetEl.scrollTop = 0;
    const b = sheetEl?.querySelector<HTMLButtonElement>('button');
    if (b) b.focus({ preventScroll: true });
  });
}
export function closeSheet() {
  sheetState.open = false;
  sheetState.html = '';
  sheetState.buttons = [];
}
export function chipsHtml(chips: Chip[], pop = false): string {
  if (!chips.length) return '';
  return `<div class="chips">${chips
    .map(
      (c, i) =>
        `<span class="chip ${pop ? 'pop' : ''} ${c.bad || c.d < 0 ? 'down' : 'up'}" style="--d:${i * 70}ms">${c.label} ${
          c.text || (c.money ? (c.d > 0 ? '+' : '') + fmtMoney(c.d) : (c.d > 0 ? '+' : '') + c.d)
        }</span>`,
    )
    .join('')}</div>`;
}
export function showSheet(html: string, btns: SheetButton[]) {
  sheetState.html = html;
  sheetState.buttons = btns;
  sheetState.open = true;
  queueMicrotask(() => {
    if (sheetEl) sheetEl.scrollTop = 0;
    const b = sheetEl?.querySelector<HTMLButtonElement>('button');
    if (b) b.focus({ preventScroll: true });
  });
}

// ───────── 진행 연출 ─────────
export const motionOK = (() => {
  try {
    return !matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return true;
  }
})();
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, motionOK ? ms : 0));

type MatchGame = { rd: number; res: 'W' | 'D' | 'L'; mins: number; g: number; a: number; rating: number; cs?: boolean; inj?: boolean };
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

export async function playSteps(title: string, steps: string[], ms = 380) {
  setBusy(true);
  openSheet(`<div class="eyebrow">${title}</div><div class="prog"><i id="an-bar"></i></div><div class="steps">${steps.map((t) => `<div>${t}</div>`).join('')}</div>`);
  await new Promise<void>((r) => queueMicrotask(() => r()));
  const rows = qAll<HTMLElement>('.steps div');
  for (let i = 0; i < rows.length; i++) {
    rows[i]!.className = 'on';
    const bar = qOne<HTMLElement>('#an-bar');
    if (bar) bar.style.width = `${((i + 1) / rows.length) * 100}%`;
    await wait(ms);
    rows[i]!.className = 'done';
  }
  await wait(150);
  setBusy(false);
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
export function playBlock(s: GameState, ph: number, b: BlockResultLike, extras: string[]): Promise<void> {
  return new Promise((resolve) => {
    setBusy(true);
    const back = s.pos === 'DF' || s.pos === 'GK';
    const opps = clubsIn(s.leagueId).filter((c) => c.id !== s.club.id);
    const n = b.games.length,
      step = clamp(2600 / Math.max(1, n), 70, 170);
    openSheet(`<div class="eyebrow">${s.year} · ${PHASES[ph]} 진행 중</div><h2>${roundRange(s, ph)} · ${n}경기</h2>
      <div class="prog"><i id="an-bar"></i></div><div class="prog-meta"><span id="an-rd">킥오프</span><span id="an-wdl">0승 0무 0패</span></div>
      <div class="tally"><div><b id="t-apps">0</b><span>출전</span></div><div><b id="t-g">0</b><span>골</span></div><div><b id="t-a">0</b><span>${back ? '무실점' : '도움'}</span></div><div><b id="t-r">-</b><span>평점</span></div></div>
      <div class="ticker" id="an-tk"></div><div class="steps" id="an-steps"></div>
      <button class="skip" id="an-skip">건너뛰기</button>`);
    let i = 0,
      w = 0,
      d = 0,
      l = 0,
      apps = 0,
      g = 0,
      a = 0,
      cs = 0,
      rs = 0,
      timer: ReturnType<typeof setTimeout> | null = null,
      done = false;
    const set = (id: string, v: string | number) => {
      const el = qOne<HTMLElement>(id);
      if (el && el.textContent !== String(v)) {
        el.textContent = String(v);
        el.classList.remove('bump');
        void el.offsetWidth;
        el.classList.add('bump');
      }
    };
    const finish = async (skipped: boolean) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      if (!skipped && extras.length) {
        const box = qOne<HTMLElement>('#an-steps');
        for (const t of extras) {
          if (!box) break;
          box.insertAdjacentHTML('beforeend', `<div class="on">${t}</div>`);
          await wait(420);
          (box.lastElementChild as HTMLElement).className = 'done';
        }
        await wait(200);
      }
      setBusy(false);
      resolve();
    };
    const tick = () => {
      if (!qOne('#an-tk')) return void finish(true);
      if (i >= n) return void finish(false);
      const m = b.games[i++]!;
      if (m.res === 'W') w++;
      else if (m.res === 'D') d++;
      else l++;
      if (m.mins) {
        apps++;
        g += m.g;
        a += m.a;
        rs += m.rating;
        if (m.cs) cs++;
      }
      const opp = opps.length ? opps[m.rd % opps.length]!.name : '상대 팀';
      const info = m.mins ? `${m.mins}분${m.g ? ` · <b>${m.g}골</b>` : ''}${m.a ? ` · ${m.a}도움` : ''} · ${m.rating}` : m.inj ? '부상 결장' : '출전 없음';
      qOne('#an-tk')!.insertAdjacentHTML('afterbegin', `<div><span class="rd">${m.rd}R</span><span class="res ${m.res}">${{ W: '승', D: '무', L: '패' }[m.res]}</span><span>${esc(opp)} ${fakeScore(m)} <span class="muted">· ${info}</span></span></div>`);
      const tk = qOne('#an-tk')!;
      while (tk.children.length > 5) tk.lastElementChild!.remove();
      qOne<HTMLElement>('#an-bar')!.style.width = `${(i / n) * 100}%`;
      qOne('#an-rd')!.textContent = `${m.rd}R / ${leagueOf(s.leagueId).matches}R`;
      qOne('#an-wdl')!.textContent = `${w}승 ${d}무 ${l}패`;
      set('#t-apps', apps);
      set('#t-g', g);
      set('#t-a', back ? cs : a);
      set('#t-r', apps ? (rs / apps).toFixed(2) : '-');
      timer = setTimeout(tick, motionOK ? step : 0);
    };
    queueMicrotask(() => {
      qOne('#an-skip')?.addEventListener('click', () => finish(true));
      tick();
    });
  });
}
export function playJudge(label: string, p: number, roll: number): Promise<void> {
  return new Promise((resolve) => {
    setBusy(true);
    openSheet(`<div class="eyebrow">판정 중</div><h2>${esc(label)}</h2>
      <div class="judge"><div class="ok" style="width:${p * 100}%"></div><div class="ng"></div><i class="needle"></i></div>
      <div class="judge-lbl"><span>성공 ${Math.round(p * 100)}%</span><span>실패 ${100 - Math.round(p * 100)}%</span></div>`);
    queueMicrotask(() => {
      const needle = qOne<HTMLElement>('.needle'),
        dur = motionOK ? 1150 : 0,
        t0 = performance.now();
      const frame = () => {
        const t = dur ? Math.min(1, (performance.now() - t0) / dur) : 1,
          ease = 1 - Math.pow(1 - t, 3);
        const sweep = (Math.sin(t * 17) + 1) / 2;
        if (needle) needle.style.left = `calc(${(sweep * (1 - ease) + roll * ease) * 100}% - 1px)`;
        if (t < 1) setTimeout(frame, 16);
        else
          setTimeout(() => {
            setBusy(false);
            resolve();
          }, motionOK ? 280 : 0);
      };
      frame();
    });
  });
}
