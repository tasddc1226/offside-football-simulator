// T-11-387 장면 경기 — 문자중계 도중 고르는 장면 카드와 중계 줄. 웹 TeamLive.svelte · 앱 TeamLive.tsx가 같이 쓴다.
// 결과는 서버가 정한다(api/team chooseMoment). 여기서는 장면 문구 · 선택지 표시 · 지금 스코어로 다시 쓴 중계 줄만 만든다.
import type { TeamMatch, TeamMatchEvent, TeamMoment } from './api/team.js';
import { teamMomentsText as M } from './i18n/ko/teamMoments.js';
import { fullTimeText, goalLineText, halfTimeText, type LiveLine } from './teamLive.js';

/** 선수 표시 이름(내 선수는 이 기기에 남은 이름). */
export type NameOf = (id: string | null, fallback: string) => string;

type Params = { name: string; pos: string; mate: string; opp: string };
type Say = string | ((p: Params) => string);
const dict = M as unknown as Record<string, Say | undefined>;
const say = (key: string, p: Params) => {
  const v = dict[key];
  return typeof v === 'function' ? v(p) : (v ?? '');
};

const paramsOf = (m: TeamMoment, name: NameOf): Params => ({
  name: name(m.actor.id, m.actor.name),
  pos: m.actor.slot,
  mate: name(m.mate.id, m.mate.name),
  opp: m.opp.name,
});

export const momentTitle = (m: Pick<TeamMoment, 'kind'>) =>
  m.kind === 'chance' ? M.chanceTitle : M.crisisTitle;

/** 장면 설명 한 문장. */
export const momentScene = (m: TeamMoment, name: NameOf) =>
  say(`s:${m.situation}`, paramsOf(m, name));

export type MomentChoiceView = {
  id: string;
  label: string;
  pct: number;
  /** 확률 옆에 붙는 짧은 꼬리표(역습 위험 · 동료 마무리). */
  tags: string[];
};

/** 장면 카드의 선택지(서버가 준 순서 그대로). */
export function momentChoices(m: TeamMoment, name: NameOf): MomentChoiceView[] {
  const p = paramsOf(m, name);
  return m.choices.map((c) => ({
    id: c.id,
    label: say(`c:${m.situation}:${c.id}`, p) || c.id,
    pct: c.pct,
    tags: [
      ...(c.mate ? [M.mateFinish({ mate: p.mate })] : []),
      ...(c.risk ? [M.risk({ p: c.risk })] : []),
      ...(c.gain ? [M.gain({ p: c.gain })] : []),
    ],
  }));
}

/** 고른 선택지 이름('auto'면 감독에게 맡김). */
export const pickedLabel = (m: TeamMoment, name: NameOf) =>
  !m.picked || m.picked === 'auto'
    ? M.recordAuto
    : say(`c:${m.situation}:${m.picked}`, paramsOf(m, name)) || m.picked;

/**
 * 장면 경기의 스코어 · 골 줄 상태. 장면 골이 일반 골 사이에 끼어들므로, 대본의 골 · 하프타임 · 경기 종료 줄을 보여 줄 때
 * 지금 스코어로 문구를 다시 쓴다.
 */
export class LiveScore {
  h = 0;
  a = 0;
  private per = new Map<string, number>();
  constructor(
    private readonly m: Pick<TeamMatch, 'home' | 'away' | 'mine'>,
    private readonly neutral = false,
  ) {}

  get score(): [number, number] {
    return [this.h, this.a];
  }

  private goalLine(
    side: 'home' | 'away',
    minute: number,
    scorer: string,
    assist: string | null,
    key: string,
    base?: LiveLine,
  ): LiveLine {
    const before: [number, number] = [this.h, this.a];
    if (side === 'home') this.h++;
    else this.a++;
    const n = (this.per.get(key) ?? 0) + 1;
    this.per.set(key, n);
    const t = side === 'home' ? this.m.home.name : this.m.away.name;
    return {
      ...(base ?? {}),
      minute,
      kind: 'goal',
      side,
      text: goalLineText(t, side, minute, scorer, assist, before, n),
      score: [this.h, this.a],
      goal: { scorer, assist, key },
    };
  }

  /** 대본 줄을 지금 스코어로(골 · 하프타임 · 경기 종료만 바뀐다). */
  line(l: LiveLine): LiveLine {
    if (l.kind === 'goal' && l.goal && l.side)
      return this.goalLine(l.side, l.minute, l.goal.scorer, l.goal.assist, l.goal.key, l);
    if (l.kind === 'ht') return { ...l, text: halfTimeText(this.m, this.h, this.a) };
    if (l.kind === 'ft') return { ...l, text: fullTimeText(this.m, this.h, this.a, this.neutral) };
    return l;
  }

  /** 장면에서 난 골 한 줄. */
  event(e: TeamMatchEvent, name: NameOf): LiveLine {
    return this.goalLine(
      e.side,
      e.minute,
      name(e.scorerId, e.scorer),
      e.assist ? name(e.assistId, e.assist) : null,
      `${e.side}:${e.scorerId ?? e.scorer}`,
    );
  }
}

/**
 * 판정한 장면의 중계 줄: 장면 한 줄(제목 · 고른 선택지) → 막힘 · 선방 한 줄(골이 아니면) → 골 줄. 골 줄은 score에 반영된다.
 */
export function momentLines(
  m: TeamMoment,
  goals: readonly TeamMatchEvent[],
  name: NameOf,
  score: LiveScore,
): LiveLine[] {
  const side = m.kind === 'chance' ? 'home' : 'away';
  const actor = name(m.actor.id, m.actor.name);
  const out: LiveLine[] = [
    {
      minute: m.minute,
      kind: 'moment',
      side,
      text: `${momentTitle(m)} · ${m.picked === 'auto' ? M.auto : pickedLabel(m, name)}`,
    },
  ];
  if (m.kind === 'chance' && !m.ok)
    out.push({ minute: m.minute, kind: 'save', side, text: M.chanceMiss({ name: actor }) });
  if (m.kind === 'crisis' && m.ok)
    out.push({ minute: m.minute, kind: 'save', side: 'home', text: M.crisisSave({ name: actor }) });
  for (const e of goals) out.push(score.event(e, name));
  return out;
}
