// T-11-390 결정적 장면의 장면(상황) · 선택지 · 성공 확률 표. 엔진(moments.ts)은 고른 확률만 받으므로 이 표는 화면이 장면을 띄울 때
// 불러온다(첫 화면 청크에 넣지 않는다). 확률 = 맡겼을 때 확률 + 선택지 보정 + 쓰는 능력치와 리그 평균의 차이 보정.
import type { AttrKey, Pos } from './data.js';
import { clamp } from './rng.js';
import type { CareerMoment, MomentKind, MomentPick } from './moments.js';
import type { GameState } from './types.js';

export interface MomentChoiceDef {
  id: string;
  /** 성공 확률을 올리거나 내리는 능력치(리그 평균과 비교). */
  attr: AttrKey;
  /** 선택지 자체의 보정(맡기기보다 조금 불리하게 두고 능력치로 메운다). */
  adj: number;
}
/** 장면(상황) 정의. 문구는 app-core i18n careerMoments의 `s:<id>` · `c:<id>:<choice>`. */
export const CAREER_SITUATIONS: Record<
  string,
  { kind: MomentKind; pos: Pos[]; choices: MomentChoiceDef[] }
> = {
  'c-1v1': {
    kind: 'chance',
    pos: ['FW'],
    choices: [
      { id: 'power', attr: 'sho', adj: 0 },
      { id: 'chip', attr: 'dri', adj: -0.02 },
      { id: 'round', attr: 'pac', adj: -0.03 },
    ],
  },
  'c-cross': {
    kind: 'chance',
    pos: ['FW'],
    choices: [
      { id: 'header', attr: 'phy', adj: 0 },
      { id: 'volley', attr: 'sho', adj: -0.03 },
    ],
  },
  'c-box': {
    kind: 'chance',
    pos: ['FW'],
    choices: [
      { id: 'turn', attr: 'sho', adj: 0 },
      { id: 'dribble', attr: 'dri', adj: -0.02 },
      { id: 'layoff', attr: 'pas', adj: -0.02 },
    ],
  },
  'c-edge': {
    kind: 'chance',
    pos: ['MF'],
    choices: [
      { id: 'pass', attr: 'pas', adj: 0 },
      { id: 'long', attr: 'sho', adj: -0.03 },
      { id: 'carry', attr: 'dri', adj: -0.02 },
    ],
  },
  'c-counter': {
    kind: 'chance',
    pos: ['MF'],
    choices: [
      { id: 'square', attr: 'pas', adj: 0 },
      { id: 'sprint', attr: 'pac', adj: -0.01 },
      { id: 'early', attr: 'sho', adj: -0.04 },
    ],
  },
  'c-through': {
    kind: 'chance',
    pos: ['MF'],
    choices: [
      { id: 'thread', attr: 'pas', adj: 0 },
      { id: 'run', attr: 'pac', adj: -0.02 },
      { id: 'shot', attr: 'sho', adj: -0.04 },
    ],
  },
  'd-1v1': {
    kind: 'crisis',
    pos: ['DF'],
    choices: [
      { id: 'tackle', attr: 'def', adj: 0 },
      { id: 'jockey', attr: 'pac', adj: -0.01 },
      { id: 'shoulder', attr: 'phy', adj: -0.02 },
    ],
  },
  'd-cross': {
    kind: 'crisis',
    pos: ['DF'],
    choices: [
      { id: 'head', attr: 'phy', adj: 0 },
      { id: 'cut', attr: 'def', adj: -0.01 },
    ],
  },
  'd-counter': {
    kind: 'crisis',
    pos: ['DF'],
    choices: [
      { id: 'chase', attr: 'pac', adj: 0 },
      { id: 'cover', attr: 'def', adj: -0.01 },
      { id: 'block', attr: 'phy', adj: -0.02 },
    ],
  },
  'g-1v1': {
    kind: 'crisis',
    pos: ['GK'],
    choices: [
      { id: 'rush', attr: 'pac', adj: 0 },
      { id: 'set', attr: 'def', adj: 0 },
      { id: 'spread', attr: 'phy', adj: -0.02 },
    ],
  },
  'g-shot': {
    kind: 'crisis',
    pos: ['GK'],
    choices: [
      { id: 'dive', attr: 'def', adj: 0 },
      { id: 'punch', attr: 'phy', adj: -0.01 },
    ],
  },
  'g-cross': {
    kind: 'crisis',
    pos: ['GK'],
    choices: [
      { id: 'claim', attr: 'phy', adj: 0 },
      { id: 'stay', attr: 'def', adj: -0.01 },
    ],
  },
};

/** 능력치가 리그 평균보다 1 높을 때 성공 확률에 더하는 몫과 그 상한. */
const EDGE_K = 0.006;
const EDGE_CAP = 0.1;
const PCT_MIN = 0.03;
const PCT_MAX = 0.97;

export interface CareerMomentChoice {
  id: string;
  attr: AttrKey;
  pct: number;
}

/** 이 장면의 상황 id(포지션에 맞는 것 가운데 장면 난수로). */
export function situationOf(m: CareerMoment, pos: Pos): string {
  const ids = Object.keys(CAREER_SITUATIONS).filter((id) =>
    CAREER_SITUATIONS[id]!.pos.includes(pos),
  );
  return ids[Math.floor(m.sit * ids.length)]!;
}

/** 선택지별 성공 확률. avg는 리그 평균 능력치. */
export function momentChoices(s: GameState, m: CareerMoment, avg: number): CareerMomentChoice[] {
  return CAREER_SITUATIONS[situationOf(m, s.pos)]!.choices.map((c) => ({
    id: c.id,
    attr: c.attr,
    pct: clamp(
      m.base + c.adj + clamp((s.attrs[c.attr] - avg) * EDGE_K, -EDGE_CAP, EDGE_CAP),
      PCT_MIN,
      PCT_MAX,
    ),
  }));
}

/** 고른 선택지를 엔진에 넘길 값으로. */
export const momentPick = (c: CareerMomentChoice): MomentPick => ({
  pct: c.pct,
  ...(c.attr === 'sho' ? { shot: true } : {}),
});
