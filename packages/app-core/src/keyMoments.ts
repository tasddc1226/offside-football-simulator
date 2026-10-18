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
export { momentHooks } from '@offside/game/moments';
import type { PhaseResult } from '@offside/game/turn';
import type { GameState } from '@offside/game/types';
import { keyMomentText as K } from './i18n/ko/keyMoment.js';
import type { MomentCard, MomentDriver, MomentView, TickerRow } from './sheets.js';

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
 * 구간 중계가 쓰는 장면 진행. rerun은 구간 전 상태로 되돌려 picks로 다시 진행하고(게임 상태가 바뀐다),
 * lines는 그 결과의 경기 줄 · 부가 줄을 만든다. cur · rows는 마지막으로 정한 결과다(리포트가 쓴다).
 */
export function createMomentDriver(o: {
  s: GameState;
  first: PhaseResult;
  rows: TickerRow[];
  extras: string[];
  rerun: (picks: MomentPicks) => PhaseResult;
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
      const line = d.cur.comp[j];
      if (!line?.comp) return null;
      return ask(
        d.cur.moments.find((x) => x.at === 'final' && x.comp === line.comp),
        j,
      );
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
        const r = o.rerun(picks);
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
