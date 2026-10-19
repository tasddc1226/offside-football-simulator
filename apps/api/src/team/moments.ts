// T-11-387 장면 경기 — 랭크 경기 문자중계 도중 우리 팀 찬스 · 위기에서 구단주가 선택지를 고르면 서버가 확률을 굴린다.
//
// 기대 득점 중 MOMENT_RULES.share만큼은 일반 골이 아니라 장면으로 만든다. 장면 수는 (몫 × 기대 득점 ÷ 자동 선택 성공 확률)의
// 포아송이고, 장면마다 자동 선택이면 기본 확률로 골이 되므로 자동 선택 경기의 골 수 분포는 장면 없는 경기와 같다(포아송 솎기).
// 장면의 판정값(roll)은 경기를 시작할 때 미리 굴려 둔다 — 고른 선택지는 문턱(확률)만 바꾸고, 같은 장면을 다시 보내도 결과가 같다.
import { BASE_DETAIL, type DetailPos } from '@offside/contracts/positions';
import {
  MOMENT_RULES as R,
  SITUATIONS,
  type MomentChoiceDef,
  type MomentKind,
  type SituationDef,
} from '@offside/contracts/team-moments';
import {
  SCORE_W,
  addGoalEvents,
  matchSetup,
  pick,
  poisson,
  rngOf,
  seedOf,
  type LineupSlot,
  type MatchCoaches,
  type PlayerRef,
  type SideReport,
  type SimEvent,
  type SimResult,
} from './sim.js';

/** 장면 한 사람(이름은 읽을 때 붙인다). */
export type MomentActor = { ref: PlayerRef; slot: DetailPos; publicName: string | null };

/** 고를 수 있는 선택지(확률은 정수 %, 찬스는 골 · 위기는 막을 확률). */
export type MomentChoice = { id: string; pct: number; mate: boolean; risk: number; gain: number };

export type StoredMoment = {
  minute: number;
  kind: MomentKind;
  situation: string;
  actor: MomentActor;
  /** 찬스: 동료 마무리 · 역습 마무리. 위기: 역습 마무리. */
  mate: MomentActor;
  /** 상대 공격수(위기 장면 · 실패한 찬스의 역습 마무리). */
  opp: MomentActor;
  choices: MomentChoice[];
  /** 미리 굴린 판정값(0~100). */
  roll: number;
  counterRoll: number;
  /** 화면에서 고르는 장면이면 true, 넘쳐서 자동 선택한 장면이면 false. */
  shown: boolean;
  /** 고른 선택지 id('auto' = 자동 선택). 아직 안 골랐으면 없다. */
  picked?: string;
  ok?: boolean;
  goals?: SimEvent[];
};

export type LiveState = {
  /** 장면을 뺀 일반 골. */
  base: SimEvent[];
  moments: StoredMoment[];
  synergy?: SimResult['synergy'];
  report: { home: SideReport; away: SideReport };
};

const AUTO = 'auto';

/** 위기 장면 주인공을 고르는 자리 가중치(수비 쪽). */
const DEFEND_W: Record<DetailPos, number> = Object.fromEntries(
  Object.entries(BASE_DETAIL).map(([d, b]) => [
    d,
    { GK: 1.4, CB: 2, FB: 1.4, DM: 1.2, CM: 0.6, AM: 0.3, W: 0.4, ST: 0.1 }[b],
  ]),
) as Record<DetailPos, number>;
/** 찬스 장면 주인공을 고르는 자리 가중치(득점 가중치 + 골키퍼 제외 모두 조금). */
const ATTACK_W: Record<DetailPos, number> = Object.fromEntries(
  Object.entries(SCORE_W).map(([d, w]) => [d, d === 'GK' ? 0 : w + 0.6]),
) as Record<DetailPos, number>;

const actorOf = (s: LineupSlot): MomentActor => ({
  ref: s.ref,
  slot: s.slot,
  publicName: s.publicName,
});

const avgRating = (lineup: readonly LineupSlot[]) =>
  lineup.reduce((a, s) => a + s.rating, 0) / lineup.length;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** 선택지 확률(정수 %). 유형이 맞으면 보너스, 그 선수가 우리 선발 평균보다 잘하면 조금 더. */
export function choicePct(
  kind: MomentKind,
  c: MomentChoiceDef,
  actor: LineupSlot,
  mate: LineupSlot,
  teamAvg: number,
): number {
  const who = c.mate ? mate : actor;
  const edge = clamp((who.rating - teamAvg) * R.edgeK, -R.edgeMax, R.edgeMax);
  const typed = actor.syn?.type && c.types?.includes(actor.syn.type) ? R.typeBonus : 0;
  const p =
    kind === 'chance'
      ? clamp(R.chanceAuto + c.adj + R.choiceShift + typed + edge, R.chanceMin, R.chanceMax)
      : clamp(R.crisisAuto + c.adj + R.choiceShift + typed + edge, R.crisisMin, R.crisisMax);
  return Math.round(p * 100);
}

const AUTO_PCT: Record<MomentKind, number> = {
  chance: Math.round(R.chanceAuto * 100),
  crisis: Math.round(R.crisisAuto * 100),
};

/** 자리에 맞는 장면을 고른다(이 경기에서 이미 나온 장면은 피한다). */
function situationFor(
  kind: MomentKind,
  slot: DetailPos,
  used: Set<string>,
  rng: () => number,
): SituationDef {
  const all = SITUATIONS.filter((s) => s.kind === kind);
  const fit = all.filter((s) => s.roles.includes(BASE_DETAIL[slot]));
  const fresh = fit.filter((s) => !used.has(s.id));
  const pool = fresh.length ? fresh : fit.length ? fit : all;
  const s = pool[Math.floor(rng() * pool.length)]!;
  used.add(s.id);
  return s;
}

/**
 * 경기를 시작할 때 일반 골과 장면을 굴린다. home이 경기를 건 쪽(구단주)이다 — 찬스는 home의 공격, 위기는 away의 공격이다.
 * 장면이 maxShown보다 많으면 남는 장면은 자동 선택으로 바로 판정해 일반 중계에 섞는다.
 */
export function startLiveMatch(
  seed: string,
  home: readonly LineupSlot[],
  away: readonly LineupSlot[],
  season: number,
  opts: { coaches?: MatchCoaches } = {},
): LiveState {
  const setup = matchSetup(home, away, season, opts);
  const rng = rngOf(seedOf(`${seed}:live`));
  const keep = 1 - R.share;
  const base: SimEvent[] = [];
  addGoalEvents(base, 'home', home, poisson(setup.homeXg * keep, rng), rng);
  addGoalEvents(base, 'away', away, poisson(setup.awayXg * keep, rng), rng);
  const nChance = poisson((setup.homeXg * R.share) / R.chanceAuto, rng);
  const nCrisis = poisson((setup.awayXg * R.share) / (1 - R.crisisAuto), rng);
  const homeAvg = avgRating(home);
  const used = new Set<string>();
  const moments: StoredMoment[] = [];
  const make = (kind: MomentKind) => {
    const minute = 1 + Math.floor(rng() * 90);
    const ai = pick(home, kind === 'chance' ? ATTACK_W : DEFEND_W, rng);
    const mi = pick(home, SCORE_W, rng, ai);
    const oi = pick(away, SCORE_W, rng);
    const actor = home[ai]!;
    const mate = home[mi >= 0 ? mi : ai]!;
    const sit = situationFor(kind, actor.slot, used, rng);
    moments.push({
      minute,
      kind,
      situation: sit.id,
      actor: actorOf(actor),
      mate: actorOf(mate),
      opp: actorOf(away[oi]!),
      choices: sit.choices.map((c) => ({
        id: c.id,
        pct: choicePct(kind, c, actor, mate, homeAvg),
        mate: !!c.mate,
        risk: c.risk ?? 0,
        gain: c.gain ?? 0,
      })),
      roll: Math.floor(rng() * 100),
      counterRoll: Math.floor(rng() * 100),
      shown: true,
    });
  };
  for (let i = 0; i < nChance; i++) make('chance');
  for (let i = 0; i < nCrisis; i++) make('crisis');
  moments.sort((a, b) => a.minute - b.minute);
  // 넘치는 장면은 무작위로 골라 자동 선택한다.
  const order = moments.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  for (const i of order.slice(R.maxShown)) {
    const m = moments[i]!;
    m.shown = false;
    resolveMoment(m, AUTO);
  }
  return {
    base,
    moments,
    ...(setup.synergy ? { synergy: setup.synergy } : {}),
    report: setup.report,
  };
}

const goal = (
  minute: number,
  side: 'home' | 'away',
  scorer: MomentActor,
  assist?: MomentActor,
) => ({
  minute,
  side,
  slot: scorer.slot,
  scorer: scorer.ref,
  assist: assist?.ref ?? null,
});

/** 장면 하나를 판정한다(이미 판정했으면 그대로 둔다). choice는 선택지 id 또는 'auto'. 모르는 id면 false. */
export function resolveMoment(m: StoredMoment, choice: string): boolean {
  if (m.picked !== undefined) return true;
  const c = choice === AUTO ? null : m.choices.find((x) => x.id === choice);
  if (choice !== AUTO && !c) return false;
  const pct = c?.pct ?? AUTO_PCT[m.kind];
  const ok = m.roll < pct;
  const next = Math.min(90, m.minute + 1);
  const goals: SimEvent[] = [];
  if (m.kind === 'chance') {
    if (ok)
      goals.push(
        c?.mate ? goal(m.minute, 'home', m.mate, m.actor) : goal(m.minute, 'home', m.actor),
      );
    else if (c && m.counterRoll < Math.round(c.risk * 100)) goals.push(goal(next, 'away', m.opp));
  } else if (!ok) goals.push(goal(m.minute, 'away', m.opp));
  else if (c && m.counterRoll < Math.round(c.gain * 100)) goals.push(goal(next, 'home', m.mate));
  m.picked = c ? c.id : AUTO;
  m.ok = ok;
  m.goals = goals;
  return true;
}

/** 남은 장면을 모두 자동 선택으로 판정한다. */
export const finishMoments = (s: LiveState) => {
  for (const m of s.moments) resolveMoment(m, AUTO);
};

export const liveDone = (s: LiveState) => s.moments.every((m) => m.picked !== undefined);

/** 지금까지 정해진 골(일반 골 + 판정한 장면의 골), 분 순서. */
export function liveEvents(s: LiveState): SimEvent[] {
  return [...s.base, ...s.moments.flatMap((m) => m.goals ?? [])].sort(
    (a, b) => a.minute - b.minute,
  );
}

/** 다 판정한 경기를 일반 경기 결과 모양으로. */
export function liveResult(s: LiveState): SimResult {
  const events = liveEvents(s);
  return {
    homeGoals: events.filter((e) => e.side === 'home').length,
    awayGoals: events.filter((e) => e.side === 'away').length,
    events,
    ...(s.synergy ? { synergy: s.synergy } : {}),
    report: s.report,
  };
}
