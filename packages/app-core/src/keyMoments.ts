// T-11-390 선수 커리어 결정적 장면 — 구간 중계 시트(playBlock)가 멈추고 띄우는 카드와, 고른 선택지로 구간을 다시 진행하는 쪽.
// 결과는 엔진(game/moments.ts)이 정한다. 여기서는 카드 문구를 만들고, 이미 보여 준 줄은 그대로 둔 채 남은 경기 · 대회 줄만 바꾼다.
// 구간 진행을 누를 때 불러온다(game-actions advance) — 장면 표 · 문구는 첫 화면 청크에 들어가지 않는다.
import { ATTR_LABEL } from '@offside/game/data';
import { clubById } from '@offside/game/clubs';
import { tn } from '@offside/game/i18n/names';
import { leagueOf } from '@offside/game/player';
import {
  momentChoices,
  momentPick,
  situationOf,
  type CareerMomentChoice,
} from '@offside/game/moment-choices';
import type { CareerMoment, MomentPicks } from '@offside/game/moments';
import { momentHooks } from '@offside/game/moments';
import { clamp, createRng, setActiveRng } from '@offside/game/rng';
import { playPhase } from '@offside/game/turn';
export { momentHooks };
import type { CompLine } from '@offside/game/comps';
import type { PhaseResult } from '@offside/game/turn';
import type { GameState } from '@offside/game/types';
import { keyMomentText as K } from './i18n/ko/keyMoment.js';
import type { MomentCard, MomentDriver, MomentView, SheetView, TickerRow } from './sheets.js';
import { STEP_MS, type SheetController } from './sheet-controller.js';
import { shellText as L } from './i18n/ko/shell.js';
import type { BlockResult } from '@offside/game/match';

const playedFinal = (l: CompLine) => l.games.some((g) => g.stage === '결승' && g.mins > 0); // i18n-ignore 저장값
/** 선택 제한 시간(초)과 고른 뒤 결과 줄이 머무는 시간. */
const SECONDS = 15;
const RESULT_MS = 1800;
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type Say = string | ((p: { name: string }) => string);
const dict = K as unknown as Record<string, Say | undefined>;
const say = (key: string, name: string) => {
  const v = dict[key];
  return typeof v === 'function' ? v({ name }) : (v ?? '');
};
const clubName = (id: string | undefined) => {
  const c = id ? clubById(id) : null;
  return c ? tn(c.name) : null;
};
const kindTitle = (m: CareerMoment) => (m.kind === 'chance' ? K.chanceTitle : K.crisisTitle);
const choiceLabel = (sit: string, id: string) => say(`c:${sit}:${id}`, '') || id;

/** 장면 카드(지금 언어)와 선택지별 확률. */
export function momentCard(
  s: GameState,
  m: CareerMoment,
  r: PhaseResult,
): MomentCard & { raw: CareerMomentChoice[] } {
  const final = m.at === 'final';
  const opp = final ? clubName(m.opp) : clubName(r.block?.games[m.game!]?.opp);
  const sit = situationOf(m, s.pos);
  const raw = momentChoices(s, m, leagueOf(s.leagueId).avg);
  return {
    key: m.key,
    kind: m.kind,
    final,
    title: final ? K.finalTitle({ comp: tn(m.comp!) }) : kindTitle(m),
    head: final
      ? opp
        ? `${kindTitle(m)} · ${opp}`
        : kindTitle(m)
      : K.leagueHead({ rd: m.rd!, opp: opp ?? '' }),
    scene: say(`s:${sit}`, s.name),
    choices: raw.map((c) => ({
      id: c.id,
      label: choiceLabel(sit, c.id),
      pct: Math.round(c.pct * 100),
      attr: ATTR_LABEL[c.attr],
    })),
    auto: Math.round(m.base * 100),
    raw,
  };
}

/** 고른 뒤 결과 줄. label은 고른 선택지 이름(맡겼으면 없다). */
export function momentResult(
  s: GameState,
  m: CareerMoment,
  r: PhaseResult,
  label: string | null,
): { text: string; ok: boolean; picked: string } {
  const name = s.name;
  let text: string;
  if (m.at === 'final') text = (m.ok ? K.finalWon : K.finalLost)({ comp: tn(m.comp!) });
  else if (m.kind === 'crisis') text = m.ok ? K.saved : K.conceded;
  else if (!m.ok) text = K.miss({ name });
  else {
    const g = r.block?.games[m.game!];
    text = m.gain === 'a' || (!m.gain && !g?.g) ? K.assist({ name }) : K.goal({ name });
  }
  return { text, ok: m.ok, picked: K.picked({ label: label ?? K.auto }) };
}

/**
 * 구간 중계가 쓰는 장면 진행. 고르면 구간 전 상태(pre · rng)로 되돌려 다시 진행하고(게임 상태가 바뀐다, settle이 저장),
 * lines는 그 결과의 경기 줄 · 부가 줄을 만든다. cur · rows는 마지막으로 정한 결과다(리포트가 쓴다).
 */
export function createMomentDriver(o: {
  s: GameState;
  first: PhaseResult;
  rows: TickerRow[];
  extras: string[];
  /** 구간 전 상태(JSON)와 난수 상태. */
  pre: string;
  rng: number;
  settle: (r: PhaseResult) => void;
  lines: (r: PhaseResult) => { rows: TickerRow[]; extras: string[] };
}): MomentDriver & {
  cur: PhaseResult;
  rows: TickerRow[];
  atGame(i: number): MomentCard | null;
  atExtra(j: number): MomentCard | null;
  /** 고른 선택지(null이면 맡김)로 구간을 다시 진행하고 결과 줄을 돌려준다. */
  decide(key: string, choice: string | null): ReturnType<typeof momentResult>;
} {
  const asked = new Map<string, { at: number; card: ReturnType<typeof momentCard> }>();
  const picks: MomentPicks = {};
  const ask = (m: CareerMoment | undefined, at: number) => {
    if (!m || asked.has(m.key)) return null;
    const card = momentCard(o.s, m, d.cur);
    asked.set(m.key, { at, card });
    return card;
  };
  const d = {
    cur: o.first,
    rows: o.rows,
    extras: o.extras,
    atGame(i: number) {
      const m = d.cur.block?.moment;
      return m?.game === i ? ask(m, i) : null;
    },
    atExtra(j: number) {
      // 결승 장면은 내가 뛴 결승이 있는 대회 줄 순서대로 열린다(엔진 compsPhase 순서).
      const lines = d.cur.comp.slice(0, j + 1).filter(playedFinal);
      if (!d.cur.comp[j] || !playedFinal(d.cur.comp[j]!)) return null;
      return ask(d.cur.moments.filter((x) => x.at === 'final')[lines.length - 1], j);
    },
    async pause(
      v: { moment?: MomentView | null; skip: (() => void) | null },
      at: { game: number } | { extra: number },
    ) {
      const card = 'game' in at ? d.atGame(at.game) : d.atExtra(at.extra);
      if (!card) return null;
      v.skip = null;
      const picked = await new Promise<string | null>((resolve) => {
        let left = SECONDS;
        const done = (id: string | null) => {
          clearInterval(tick);
          resolve(id);
        };
        const tick = setInterval(() => {
          left--;
          if (v.moment) v.moment.left = left;
          if (left <= 0) done(null);
        }, 1000);
        v.moment = { ...card, left, secs: SECONDS, result: null, choose: done };
      });
      const result = d.decide(card.key, picked);
      if (v.moment) {
        v.moment.choose = () => {};
        v.moment.result = result;
      }
      await wait(RESULT_MS);
      v.moment = null;
      return { b: d.cur.block!, rows: d.rows, extras: d.extras };
    },
    decide(key: string, choice: string | null) {
      const q = asked.get(key)!;
      const c = choice ? q.card.raw.find((x) => x.id === choice) : undefined;
      if (c) {
        picks[key] = momentPick(c);
        const s = o.s as unknown as Record<string, unknown>;
        for (const k of Object.keys(s)) delete s[k];
        Object.assign(s, JSON.parse(o.pre));
        setActiveRng(createRng(o.rng));
        const r = playPhase(o.s, momentHooks(o.s, picks));
        o.settle(r);
        const next = o.lines(r);
        // 이미 보여 준 줄은 그대로 둔다: 리그 장면이면 그 경기 앞까지, 결승이면 경기 전부와 그 대회 줄 앞까지.
        const final = key !== 'league';
        const keepRows = final ? d.rows.length : q.at;
        const keepExtras = final ? q.at : 0;
        d.rows = [...d.rows.slice(0, keepRows), ...next.rows.slice(keepRows)];
        d.extras = [...d.extras.slice(0, keepExtras), ...next.extras.slice(keepExtras)];
        d.cur = r;
      }
      const m = d.cur.moments.find((x) => x.key === key)!;
      const label = c ? q.card.choices.find((x) => x.id === c.id)!.label : null;
      return momentResult(o.s, m, d.cur, label);
    },
  };
  return d;
}

type ViewOf<K extends SheetView['kind']> = Extract<SheetView, { kind: K }>;
/** 한 구간(시즌 절반) 문자중계 총 길이 목표와 경기당 간격 범위. */
const BLOCK_TOTAL_MS = 3600;
const BLOCK_STEP_MIN = 120;
const BLOCK_STEP_MAX = 260;
/** 건너뛰기로 남은 경기를 한 번에 채울 때 막대가 끝까지 차는 시간. */
const SKIP_FILL_MS = 240;

/**
 * T-10-028: 구간 경기를 한 경기씩 문자중계처럼 흘려보내며 승무패·출전 기록을 쌓는다(T-10-024에서 뺐던
 * 연출을 되살림). rows는 리포트와 같은 줄이라 스코어가 두 화면에서 같다.
 * T-10-029: 다 나온 뒤엔 바로 닫지 않고 '확인' 버튼을 눌러야 끝난다(결과를 읽을 시간). 건너뛰기는 남은
 * 경기를 한 번에 채워 최종 기록을 보여 주고 같은 확인 버튼을 띄운다.
 * 리그 구간은 늘 이 모듈과 함께 불러오므로 첫 화면 청크에서 빼 여기 둔다(T-11-390).
 * T-11-390 mo가 있으면 결정적 장면이 걸린 경기 · 결승 줄 앞에서 멈추고 선택 카드를 띄운다(건너뛰기도 장면에서는 멈춘다).
 * 고르면 mo.decide가 구간을 다시 진행한 결과로 남은 경기 · 줄을 바꾼다.
 */
export async function playBlock(
  c: Pick<SheetController, 'state' | 'ui' | 'showSheet'>,
  head: { eyebrow: string; title: string; back: boolean; matches: number },
  b: BlockResult,
  rows: TickerRow[],
  extras: string[],
  mo?: MomentDriver,
): Promise<void> {
  c.state.busy = true;
  const n = rows.length,
    step = clamp(BLOCK_TOTAL_MS / Math.max(1, n), BLOCK_STEP_MIN, BLOCK_STEP_MAX);
  let i = 0,
    rs = 0,
    fast = false,
    wake: (() => void) | null = null;
  /** ms 동안 쉬되 건너뛰기를 누르면 바로 깬다. */
  const sleep = (ms: number) =>
    new Promise<void>((r) => {
      const t = setTimeout(r, ms);
      // 이미 깬 뒤에 다시 불러도 끝난 타이머 · 약속이라 아무 일도 없다.
      wake = () => {
        clearTimeout(t);
        r();
      };
    });
  const skip = () => {
    fast = true;
    v.skip = null;
    v.fill = SKIP_FILL_MS;
    wake?.();
  };
  const v = c.showSheet<ViewOf<'block'>>({
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
    skip,
    moment: null,
  });
  // 시트가 다른 내용으로 바뀌었거나 닫혔으면 확인 없이 끝낸다.
  const gone = () => c.state.view !== v;
  /** T-11-390 장면이 걸린 곳이면 멈춰 고르게 하고, 고른 결과로 남은 경기 · 줄을 바꾼다. */
  const pause = async (at: { game: number } | { extra: number }) => {
    const hit = await mo?.pause(v, at);
    if (!hit) return;
    ({ b, rows, extras } = hit);
    if (!fast) v.skip = skip;
  };
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
  await c.ui.tick();
  await c.ui.painted();
  while (i < n) {
    if (gone()) break;
    await pause({ game: i });
    playNext();
    if (!fast) await sleep(step);
  }
  if (gone()) {
    c.state.busy = false;
    return;
  }
  v.skip = null;
  v.rated = b.games;
  for (let j = 0; j < extras.length; j++) {
    await pause({ extra: j });
    v.extras.push({ text: extras[j]!, done: fast });
    if (!fast) {
      await wait(STEP_MS);
      v.extras[v.extras.length - 1]!.done = true;
    }
  }
  // 확인을 누를 때까지 busy로 두어 배경 클릭·스와이프로 닫히지 않게 한다.
  await new Promise<void>((resolve) => {
    c.state.buttons = [
      {
        label: L.confirm,
        cls: 'btn-primary',
        fn: () => {
          c.state.busy = false;
          resolve();
        },
      },
    ];
    void c.ui.tick().then(() => c.ui.focusFirstButton?.());
  });
}
