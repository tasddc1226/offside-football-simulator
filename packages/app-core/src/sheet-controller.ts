// ───────── 시트 진행 연출 (웹·앱 공용, T-11-002) ─────────
// 아래에서 올라오는 시트 하나에 뷰 모델(sheets.ts)을 띄우고, 진행 단계·경기 중계·판정 바늘·미니게임을 시간에 맞춰
// 채운다. 상태 객체는 클라이언트가 반응형으로 감싸 넘긴다(웹 Svelte `$state`, 앱 스토어) — 여기서는 그 객체를
// 고치기만 한다. 띄운 뷰는 showSheet이 돌려준 것(state.view를 다시 읽은 반응형 프록시)을 고쳐야 화면이 바뀐다.
import { clamp, ri } from '@offside/game/rng';
import { clubsIn } from '@offside/game/engine';
import { tn } from '@offside/game/i18n/names';
import { clubById } from '@offside/game/clubs';
import type { Club } from '@offside/game/data';
import type { BlockResult, MatchGame } from '@offside/game/match';
import type { GameState } from '@offside/game/types';
import type { MgKind } from '@offside/game/minigame';
import type { DragPoint, ShotResult } from '@offside/game/dragShot';
import { FLIGHT_MS, FLIGHT_STILL_MS } from './flight-time.js';
import type { SheetButton, SheetView, TickerRow } from './sheets.js';
import { shellText as L } from './i18n/ko/shell.js';

type ViewOf<K extends SheetView['kind']> = Extract<SheetView, { kind: K }>;

export interface SheetState {
  open: boolean;
  busy: boolean;
  view: SheetView | null;
  buttons: SheetButton[];
}

export const initialSheetState = (): SheetState => ({
  open: false,
  busy: false,
  view: null,
  buttons: [],
});

/** 클라이언트가 넣는 화면 쪽 동작. */
export interface SheetUi {
  /** 상태 변경이 화면에 반영될 때까지(웹 Svelte tick). */
  tick(): Promise<void>;
  /** 시트가 그려지고 한 번 칠해질 때까지 — 그 전에 막대 폭을 바꾸면 0%에서 차오르지 않고 바로 뛴다. */
  painted(): Promise<void>;
  /** 시트를 띄운 직후(스크롤·포커스 초기화). */
  afterShow?(): void;
  /** 경기 중계가 끝나 확인 버튼이 생겼을 때(포커스). */
  focusFirstButton?(): void;
  /** 미니게임 장면을 미리 불러 둔다(웹 지연 로드). */
  preloadMinigame?(): Promise<unknown>;
  /** 감속 모션이 아니면 true — 판정 바늘을 흔들고, 이벤트 선택지를 원터치 미니게임으로 가린다. */
  motionOK(): boolean;
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

/** 탭 뒤 결과 장면(공이 날아가고 멈추는 연출)을 보여 주는 시간. */
const MG_SCENE_MS = 1300;
/** 비행 장면이 끝나고(또는 건너뛴 뒤) 도착 표시를 보여 주는 시간. */
const ARRIVE_MS = 450;
/** 건너뛰기로 남은 경기를 한 번에 채울 때 막대가 끝까지 차는 시간. */
const SKIP_FILL_MS = 240;

/** T-11-134 엔진이 정한 상대 구단 이름. 옛 시즌 경기(상대 없음)는 null — 예전처럼 리그 클럽을 차례로 붙인다. */
function oppName(m: MatchGame): string | null {
  const club = m.opp ? clubById(m.opp) : null;
  return club ? tn(club.name) : null;
}

/** 구간 경기를 리포트의 경기별 기록 줄로 바꾼다(상대 팀 이름·스코어를 붙인다). */
export function matchRows(s: GameState, b: BlockResult): TickerRow[] {
  let opps: Club[] | undefined;
  const legacyOpp = (rd: number) => {
    opps ??= clubsIn(s.leagueId, s).filter((c) => c.id !== s.club.id);
    return opps.length ? tn(opps[rd % opps.length]!.name) : L.opponent;
  };
  return b.games.map((m, i) => ({
    key: i,
    rd: m.rd,
    res: m.res,
    opp: oppName(m) ?? legacyOpp(m.rd),
    score: fakeScore(m),
    mins: m.mins,
    g: m.g,
    a: m.a,
    rating: m.rating,
    inj: !!m.inj,
  }));
}

export function createSheetController(state: SheetState, ui: SheetUi) {
  /** 뷰를 띄우고, 이후에 고칠 뷰(state에 들어간 반응형 사본)를 돌려준다. 넘긴 원본을 고치면 화면이 바뀌지 않는다. */
  // T-11-090 바깥을 누르거나 끌어내려 닫을 때 할 일. 다른 시트를 띄우거나 버튼으로 닫으면 버린다.
  let onDismiss: (() => void) | undefined;
  function showSheet<V extends SheetView>(
    view: V,
    buttons: SheetButton[] = [],
    dismissed?: () => void,
  ): V {
    state.view = view;
    state.buttons = buttons;
    state.open = true;
    onDismiss = dismissed;
    void ui.tick().then(() => ui.afterShow?.());
    return state.view as V;
  }
  function closeSheet() {
    onDismiss = undefined;
    state.open = false;
    state.view = null;
    state.buttons = [];
  }
  /** 사용자가 시트를 바깥 탭·끌어내리기로 닫는다. 결과 시트는 버튼을 누른 것과 같은 곳으로 돌아간다. */
  function dismissSheet() {
    const fn = onDismiss;
    closeSheet();
    fn?.();
  }

  /** 단계 목록을 하나씩 켰다 끄며 진행률 막대를 채운다. 막대는 단계마다 그 단계 길이 동안 고르게 차오른다(T-10-123). */
  async function playSteps(title: string, steps: string[], ms = STEP_MS) {
    state.busy = true;
    const v = showSheet<ViewOf<'steps'>>({
      kind: 'steps',
      title,
      steps,
      active: -1,
      progress: 0,
      fill: ms,
    });
    await ui.painted();
    for (let i = 0; i < steps.length; i++) {
      v.active = i;
      v.progress = (i + 1) / steps.length;
      await wait(ms);
    }
    v.active = steps.length;
    await wait(150);
    state.busy = false;
  }

  /**
   * T-10-028: 구간 경기를 한 경기씩 문자중계처럼 흘려보내며 승무패·출전 기록을 쌓는다(T-10-024에서 뺐던
   * 연출을 되살림). rows는 리포트와 같은 줄이라 스코어가 두 화면에서 같다.
   * T-10-029: 다 나온 뒤엔 바로 닫지 않고 '확인' 버튼을 눌러야 끝난다(결과를 읽을 시간). 건너뛰기는 남은
   * 경기를 한 번에 채워 최종 기록을 보여 주고 같은 확인 버튼을 띄운다.
   */
  function playBlock(
    head: { eyebrow: string; title: string; back: boolean; matches: number },
    b: BlockResult,
    rows: TickerRow[],
    extras: string[],
  ): Promise<void> {
    return new Promise((resolve) => {
      state.busy = true;
      const n = rows.length,
        step = clamp(BLOCK_TOTAL_MS / Math.max(1, n), BLOCK_STEP_MIN, BLOCK_STEP_MAX);
      let timer: ReturnType<typeof setTimeout> | null = null,
        done = false,
        i = 0,
        rs = 0;
      /** 다음 경기 하나를 기록에 더한다. */
      const playNext = () => {
        const m = b.games[i]!,
          row = rows[i]!;
        i++;
        v.wdl[m.res === 'W' ? 'w' : m.res === 'D' ? 'd' : 'l']++;
        if (m.mins) {
          v.tally.apps++;
          v.tally.g += m.g ?? 0;
          v.tally.a += m.a ?? 0;
          rs += m.rating ?? 0;
          if (m.cs) v.tally.cs++;
          v.tally.rating = (rs / v.tally.apps).toFixed(2);
        }
        v.ticker.unshift(row);
        if (v.ticker.length > 5) v.ticker.length = 5;
        v.progress = i / n;
        v.round = `${m.rd}R / ${head.matches}R`;
      };
      const finish = async (skipped: boolean) => {
        if (done) return;
        done = true;
        if (timer) clearTimeout(timer);
        v.skip = null;
        if (skipped) {
          v.fill = SKIP_FILL_MS;
          while (i < n) playNext();
          v.extras.push(...extras.map((text) => ({ text, done: true })));
        } else {
          for (const t of extras) {
            v.extras.push({ text: t, done: false });
            await wait(STEP_MS);
            v.extras[v.extras.length - 1]!.done = true;
          }
        }
        // 확인을 누를 때까지 busy로 두어 배경 클릭·스와이프로 닫히지 않게 한다.
        state.buttons = [
          {
            label: L.confirm,
            cls: 'btn-primary',
            fn: () => {
              state.busy = false;
              resolve();
            },
          },
        ];
        void ui.tick().then(() => ui.focusFirstButton?.());
      };
      const v = showSheet<ViewOf<'block'>>({
        kind: 'block',
        eyebrow: head.eyebrow,
        title: head.title,
        back: head.back,
        progress: 0,
        fill: step,
        round: L.kickoff,
        wdl: { w: 0, d: 0, l: 0 },
        tally: { apps: 0, g: 0, a: 0, cs: 0, rating: '-' },
        ticker: [],
        extras: [],
        skip: () => void finish(true),
      });
      const tickOnce = () => {
        // 시트가 다른 내용으로 바뀌었거나 닫혔으면 확인 없이 끝낸다.
        if (state.view !== v) {
          done = true;
          state.busy = false;
          return resolve();
        }
        if (i >= n) return void finish(false);
        playNext();
        timer = setTimeout(tickOnce, step);
      };
      void ui.tick().then(ui.painted).then(tickOnce);
    });
  }

  type SceneKind = 'minigame' | 'dragShot';
  /**
   * T-10-089 입력 한 번을 받는 장면(미니게임)을 띄운다. 입력이 오면 judge가 판정·저장을 끝내고 뷰에 결과를 적는다.
   * 결과 장면을 ms 동안 보여 준 뒤 judge의 결과를 돌려준다. 두 번째 입력(제한 시간과 탭이 겹칠 때)은 버린다.
   */
  function playScene<K extends SceneKind, I, R>(
    view: (onInput: (x: I) => void) => ViewOf<K>,
    judge: (x: I, v: ViewOf<K>) => R,
    ms: number,
  ): Promise<R> {
    return new Promise((resolve) => {
      state.busy = true;
      let done = false;
      const v = showSheet(
        view((x) => {
          if (done) return;
          done = true;
          const r = judge(x, v);
          void wait(ms).then(() => {
            state.busy = false;
            resolve(r);
          });
        }),
      );
    });
  }

  /**
   * T-10-089 원터치 미니게임. 초록 구간(넓이 w)을 무작위 자리에 두고 탭을 기다린다. 탭하면 settle(바늘 위치,
   * 구간 가운데)로 판정·저장을 끝낸 뒤, 결과 장면(공이 날아가는 연출)을 보여 주고 settle의 결과를 돌려준다.
   * 구간 자리는 화면 연출이라 게임 RNG가 아니라 Math.random을 쓴다(게임 RNG 흐름을 바꾸지 않는다).
   */
  async function playMinigame<R extends { ok: boolean }>(
    label: string,
    mg: MgKind,
    w: number,
    side: -1 | 0 | null,
    settle: (x: number | null, center: number) => R,
  ): Promise<R> {
    // 웹은 장면 컴포넌트가 첫 화면 번들 밖이다 — 띄우기 전에 불러 둬야 바늘·제한 시간이 늦게 시작하지 않는다.
    // 불러오는 동안 선택지를 다시 누르지 못하게 먼저 막는다.
    state.busy = true;
    await ui.preloadMinigame?.();
    const center = w / 2 + Math.random() * (1 - w);
    return playScene<'minigame', number | null, R>(
      (onTap) => ({ kind: 'minigame', label, mg, center, w, side, ok: null, onTap }),
      (x, v) => {
        const r = settle(x, center);
        v.ok = r.ok;
        return r;
      },
      MG_SCENE_MS,
    );
  }
  /**
   * T-10-089 드래그 슛(프로토타입). 손을 떼면 경로로 슛을 판정(evalShot)하고 settle에 넘긴 뒤 결과 장면을 보여 준다.
   * 흩어짐·키퍼 방향은 화면 연출용 Math.random이다. 아직 이벤트에 연결하지 않아 판정 코드는 첫 화면 번들 밖에서 부른다.
   */
  async function playDragShot<R extends { ok: boolean }>(
    label: string,
    p: number,
    settle: (shot: ShotResult) => R,
  ): Promise<R> {
    state.busy = true;
    const { evalShot, lateShot } = await import('@offside/game/dragShot');
    return playScene<'dragShot', DragPoint[] | null, R>(
      (onShot) => ({ kind: 'dragShot', label, shot: null, onShot }),
      (path, v) => {
        const shot = path ? evalShot(path, p) : lateShot();
        const r = settle(shot);
        v.shot = shot;
        return r;
      },
      MG_SCENE_MS + 300,
    );
  }
  /**
   * T-11-039 해외 이적 비행 장면을 FLIGHT_MS(감속 모션이면 정지 장면 FLIGHT_STILL_MS) 동안 띄운다(그동안 닫히지 않는다). 건너뛰기는 바로 도착 장면을 잠깐
   * 보여 주고 끝낸다. 본문이 그려진 뒤부터 잰다 — 비행기가 날기 시작하는 시각과 맞춘다.
   */
  function playFlight(view: Omit<ViewOf<'flight'>, 'kind' | 'done' | 'skip'>): Promise<void> {
    return new Promise((resolve) => {
      state.busy = true;
      let timer: ReturnType<typeof setTimeout> | undefined,
        ended = false;
      const end = () => {
        if (ended) return;
        ended = true;
        clearTimeout(timer);
        state.busy = false;
        resolve();
      };
      const v = showSheet<ViewOf<'flight'>>({
        kind: 'flight',
        ...view,
        done: false,
        skip: () => {
          if (v.done) return;
          v.done = true;
          clearTimeout(timer);
          timer = setTimeout(end, ARRIVE_MS);
        },
      });
      void ui
        .tick()
        .then(ui.painted)
        .then(() => {
          const ms = ui.motionOK() ? FLIGHT_MS : FLIGHT_STILL_MS;
          if (!v.done) timer = setTimeout(end, ms + ARRIVE_MS);
        });
    });
  }

  /** 성공 확률 막대 위에서 바늘이 흔들리다 실제 판정값(roll)에 멈춘다. */
  function playJudge(label: string, p: number, roll: number): Promise<void> {
    return new Promise((resolve) => {
      state.busy = true;
      const v = showSheet<ViewOf<'judge'>>({ kind: 'judge', label, p, pos: 0 });
      const dur = ui.motionOK() ? 1150 : 0,
        t0 = performance.now();
      const frame = () => {
        const t = dur ? Math.min(1, (performance.now() - t0) / dur) : 1,
          ease = 1 - Math.pow(1 - t, 3);
        const sweep = (Math.sin(t * 17) + 1) / 2;
        v.pos = sweep * (1 - ease) + roll * ease;
        if (t < 1) setTimeout(frame, 16);
        else
          setTimeout(
            () => {
              state.busy = false;
              resolve();
              // 감속 모션이면 바늘이 흔들리지 않고 곧장 판정값에 서므로, 결과를 읽을 시간을 조금 더 준다.
            },
            ui.motionOK() ? 280 : 700,
          );
      };
      void ui.tick().then(frame);
    });
  }

  return {
    state,
    motionOK: ui.motionOK,
    showSheet,
    closeSheet,
    dismissSheet,
    playSteps,
    playBlock,
    playMinigame,
    playDragShot,
    playJudge,
    playFlight,
  };
}

export type SheetController = ReturnType<typeof createSheetController>;
