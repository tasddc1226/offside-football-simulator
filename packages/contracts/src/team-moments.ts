// T-11-387 팀 경기 결정적 장면. 문자중계 도중 우리 팀 찬스·위기에서 구단주가 선택지(최대 3개)를 고르면 서버가 확률을 굴려
// 결과를 정한다. 여기에는 장면·선택지 정의(id·자리·보정)만 둔다. 문구는 app-core i18n `teamMoments`, 경기 계산은
// apps/api/src/team/moments.ts. zod가 없는 서브패스(`@offside/contracts/team-moments`)라 웹·앱 번들에 넣어도 가볍다.
import type { BaseDetailPos } from './positions.js';

export type MomentKind = 'chance' | 'crisis';

/**
 * 선택지 하나. adj는 기본 확률(찬스는 골 확률, 위기는 막을 확률)에 더하는 값이다. types의 유형(커리어 유형 id)이면
 * MOMENT_RULES.typeBonus를 더 준다.
 * - 찬스: mate면 동료가 마무리하고 장면의 주인공이 도움을 올린다. risk는 실패했을 때 상대 역습 골 확률이다.
 * - 위기: gain은 막아 낸 뒤 우리 역습 골 확률이다. 실패하면 실점이다.
 */
export type MomentChoiceDef = {
  id: string;
  adj: number;
  types?: readonly string[];
  mate?: boolean;
  risk?: number;
  gain?: number;
};

export type SituationDef = {
  id: string;
  kind: MomentKind;
  /** 주인공이 될 수 있는 자리(기본 8자리, 세부 자리는 BASE_DETAIL로 묶는다). */
  roles: readonly BaseDetailPos[];
  choices: readonly MomentChoiceDef[];
};

/**
 * 장면 몫 · 기본 확률. 장면 수는 기대 득점 중 share만큼을 기본 확률로 나눈 포아송이라(포아송 솎기), 아무것도 고르지 않으면
 * (자동 선택) 골 수 분포가 장면 없는 경기와 같다. 선택지 보정은 고르는 쪽이 유리하게 만들지 않도록, 유형이 맞지 않는
 * 선택지의 기대 득실이 자동 선택과 비슷하게 잡았다.
 */
export const MOMENT_RULES = {
  share: 0.35,
  chanceAuto: 0.38,
  crisisAuto: 0.62,
  typeBonus: 0.2,
  /** 모든 선택지에 더하는 값. 유형 보너스가 무작위 선택에도 1/3쯤 붙으므로, 아무렇게나 고르면 자동 선택과 비슷해지게 뺀다. */
  choiceShift: -0.07,
  /** 그 선수 레이팅이 우리 선발 평균보다 1점 높을 때마다 더하는 확률(상한 ±edgeMax). */
  edgeK: 0.004,
  edgeMax: 0.05,
  chanceMin: 0.05,
  chanceMax: 0.9,
  crisisMin: 0.1,
  crisisMax: 0.95,
  /**
   * T-11-510 시즌 2부터 찬스는 우리 공격 − 상대 벽, 위기는 우리 벽 − 상대 공격 1점마다 더하는 확률(상한 ±gapMax). 장면 수는
   * 그만큼 바뀐 자동 선택 확률로 나눠 정해 자동 선택일 때 골 기대값은 그대로다.
   */
  gapK: 0.012,
  gapMax: 0.12,
  /** 화면에서 고르는 장면 수 상한(넘치는 장면은 자동 선택으로 일반 중계가 된다). */
  maxShown: 3,
  /** 장면 카드 제한 시간(초). 지나면 자동 선택. */
  choiceSec: 15,
  /** 고르지 않고 떠난 경기를 서버가 자동 선택으로 마감하기까지(분). */
  staleMin: 10,
} as const;

// 선택지 성격: 안전(adj 0) · 과감(+0.10, 실패하면 역습) · 동료 활용(+0.04, mate). 위기는 안전(0) · 중간(−0.04, 역습 0.08) ·
// 과감(−0.08, 역습 0.15).
const safe = (id: string, types: readonly string[]): MomentChoiceDef => ({ id, adj: 0, types });
const bold = (id: string, types: readonly string[]): MomentChoiceDef => ({
  id,
  adj: 0.1,
  types,
  risk: 0.2,
});
const team = (id: string, types: readonly string[]): MomentChoiceDef => ({
  id,
  adj: 0.04,
  types,
  mate: true,
  risk: 0.1,
});
const hold = (id: string, types: readonly string[]): MomentChoiceDef => ({ id, adj: 0, types });
const press = (id: string, types: readonly string[]): MomentChoiceDef => ({
  id,
  adj: -0.04,
  types,
  gain: 0.08,
});
const dare = (id: string, types: readonly string[]): MomentChoiceDef => ({
  id,
  adj: -0.08,
  types,
  gain: 0.15,
});

export const SITUATIONS: readonly SituationDef[] = [
  // ───── 찬스 ─────
  {
    id: 'st-1v1',
    kind: 'chance',
    roles: ['ST'],
    choices: [safe('drive', ['poacher']), team('square', ['target']), bold('round', ['speed'])],
  },
  {
    id: 'st-turn',
    kind: 'chance',
    roles: ['ST'],
    choices: [bold('turn', ['poacher']), team('layoff', ['target']), safe('shield', ['target'])],
  },
  {
    id: 'cross-header',
    kind: 'chance',
    roles: ['ST', 'W', 'AM'],
    choices: [safe('near', ['target']), bold('back', ['poacher']), team('nod', ['target'])],
  },
  {
    id: 'rebound',
    kind: 'chance',
    roles: ['ST', 'AM', 'CM', 'W'],
    choices: [safe('first', ['poacher']), bold('settle', ['b2b']), team('square', ['maker'])],
  },
  {
    id: 'offside-line',
    kind: 'chance',
    roles: ['ST', 'W'],
    choices: [bold('early', ['speed']), safe('late', ['poacher']), team('drop', ['target'])],
  },
  {
    id: 'volley',
    kind: 'chance',
    roles: ['ST', 'AM', 'CM'],
    choices: [bold('volley', ['poacher']), safe('chest', ['target']), team('cushion', ['maker'])],
  },
  {
    id: 'byline',
    kind: 'chance',
    roles: ['W', 'FB'],
    choices: [team('cutback', ['winger']), bold('tight', ['speed']), safe('cross', ['fullback'])],
  },
  {
    id: 'cut-inside',
    kind: 'chance',
    roles: ['W', 'AM'],
    choices: [bold('curl', ['winger']), safe('dribble', ['speed']), team('overlap', ['maker'])],
  },
  {
    id: 'counter-2v1',
    kind: 'chance',
    roles: ['W', 'ST', 'AM'],
    choices: [
      team('late-pass', ['maker']),
      safe('early-pass', ['speed']),
      bold('solo', ['winger']),
    ],
  },
  {
    id: 'edge-box',
    kind: 'chance',
    roles: ['AM', 'CM'],
    choices: [bold('long-shot', ['b2b']), team('through', ['maker']), safe('one-two', ['winger'])],
  },
  {
    id: 'killer-pass',
    kind: 'chance',
    roles: ['AM', 'CM', 'DM'],
    choices: [team('ground', ['maker']), bold('lofted', ['b2b']), safe('carry', ['winger'])],
  },
  {
    id: 'late-run',
    kind: 'chance',
    roles: ['CM', 'DM', 'AM'],
    choices: [bold('arrive', ['b2b']), safe('edge', ['maker']), team('cutback', ['winger'])],
  },
  {
    id: 'second-ball',
    kind: 'chance',
    roles: ['DM', 'CM', 'CB'],
    choices: [bold('strike', ['b2b']), team('recycle', ['maker']), safe('chip-in', ['libero'])],
  },
  {
    id: 'set-header',
    kind: 'chance',
    roles: ['CB', 'ST'],
    choices: [
      safe('near', ['stopper', 'target']),
      bold('far', ['libero']),
      team('flick', ['target']),
    ],
  },
  {
    id: 'overlap',
    kind: 'chance',
    roles: ['FB'],
    choices: [team('cross', ['fullback']), safe('underlap', ['winger']), bold('shoot', ['libero'])],
  },
  {
    id: 'free-kick',
    kind: 'chance',
    roles: ['AM', 'CM', 'W', 'FB', 'ST'],
    choices: [bold('curl', ['maker']), safe('under', ['winger']), team('short', ['b2b'])],
  },
  // ───── 위기 ─────
  {
    id: 'cb-1v1',
    kind: 'crisis',
    roles: ['CB'],
    choices: [dare('tackle', ['stopper']), hold('delay', ['libero']), press('trap', ['libero'])],
  },
  {
    id: 'through-ball',
    kind: 'crisis',
    roles: ['CB', 'FB', 'DM'],
    choices: [
      hold('clear', ['libero']),
      dare('shoulder', ['stopper']),
      press('race', ['fullback']),
    ],
  },
  {
    id: 'cross-clear',
    kind: 'crisis',
    roles: ['CB', 'FB'],
    choices: [hold('head', ['stopper']), dare('chest', ['libero']), press('corner', ['fullback'])],
  },
  {
    id: 'last-man',
    kind: 'crisis',
    roles: ['CB', 'FB', 'DM'],
    choices: [hold('foul', ['stopper']), dare('slide', ['stopper']), press('track', ['fullback'])],
  },
  {
    id: 'fb-1v1',
    kind: 'crisis',
    roles: ['FB'],
    choices: [dare('tight', ['fullback']), hold('outside', ['stopper']), press('poke', ['libero'])],
  },
  {
    id: 'back-post',
    kind: 'crisis',
    roles: ['FB', 'CB'],
    choices: [
      hold('body', ['stopper']),
      press('clear', ['fullback']),
      dare('intercept', ['libero']),
    ],
  },
  {
    id: 'counter-stop',
    kind: 'crisis',
    roles: ['DM', 'CM'],
    choices: [hold('foul', ['b2b']), press('retreat', ['maker']), dare('tackle', ['b2b'])],
  },
  {
    id: 'screen',
    kind: 'crisis',
    roles: ['DM', 'CM', 'AM'],
    choices: [dare('tight', ['b2b']), hold('block', ['maker']), press('lane', ['maker'])],
  },
  {
    id: 'track-back',
    kind: 'crisis',
    roles: ['W', 'AM'],
    choices: [hold('chase', ['winger']), press('foul', ['b2b']), dare('stay', ['speed'])],
  },
  {
    id: 'gk-1v1',
    kind: 'crisis',
    roles: ['GK'],
    choices: [dare('rush', ['sweeper']), hold('wait', ['shot']), press('spread', ['wall'])],
  },
  {
    id: 'gk-cross',
    kind: 'crisis',
    roles: ['GK'],
    choices: [dare('claim', ['sweeper']), hold('punch', ['wall']), press('line', ['shot'])],
  },
  {
    id: 'gk-long-shot',
    kind: 'crisis',
    roles: ['GK'],
    choices: [press('catch', ['wall']), hold('parry', ['shot']), dare('tip', ['shot'])],
  },
  {
    id: 'gk-sweep',
    kind: 'crisis',
    roles: ['GK'],
    choices: [dare('out', ['sweeper']), hold('stay', ['wall']), press('narrow', ['shot'])],
  },
];

export const SITUATION_BY_ID: ReadonlyMap<string, SituationDef> = new Map(
  SITUATIONS.map((s) => [s.id, s]),
);
