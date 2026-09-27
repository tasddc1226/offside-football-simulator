import {
  POS,
  ATTR_KEYS,
  FOCUS_GROWTH,
  OFF_FOCUS_GROWTH,
  COND_LOW_INJURY,
  COND_LOW_START,
  type AttrKey,
  type Pos,
} from './data.js';
import { ovr, wOf } from './attributes.js';
import { clamp, ri, pick, chance, rnd } from './rng.js';
import { baseline } from './candidates.js';
import { BAL } from './balance.js';
import type { GameState } from './types.js';
import { focusOf, labelOf, fmtMoney } from './player.js';
import { truePot, addAttr, addStat, fameEff, log } from './stats.js';

// ───────── 훈련 ─────────
export function growthFactor(s: GameState): number {
  const a = s.age;
  let f: number;
  if (s.trait === 'early') f = a <= 20 ? 1.5 : a <= 23 ? 1.15 : a <= 26 ? 0.6 : 0.14;
  else if (s.trait === 'late') f = a <= 21 ? 0.85 : a <= 25 ? 1.15 : a <= 29 ? 0.8 : 0.25;
  else f = a <= 21 ? 1.3 : a <= 24 ? 1 : a <= 27 ? 0.55 : a <= 30 ? 0.22 : 0.08;
  const pot = truePot(s);
  f *= clamp((pot - ovr(s)) / 12, 0.04, 1.3);
  f *= 0.75 + s.morale / 200;
  return f * BAL.growthScale;
}
export interface TrainingDef {
  id: string;
  attr?: AttrKey;
  label?: string;
}
export const TRAININGS: TrainingDef[] = [
  ...ATTR_KEYS.map((k) => ({ id: k, attr: k })),
  { id: 'rest', label: '휴식·회복' },
  { id: 'coach', label: '개인 코치' },
  { id: 'media', label: '미디어 활동' },
];
/** applyTraining과 같은 숫자 — 설명과 실제 효과가 어긋나지 않게 한곳에 둔다. */
const REST = { cond: 30, morale: 4 };
const MEDIA = { fame: [5, 9] as const, cond: -5, morale: 3 };
const COACH_COND = -6;
const trainCond = (k: AttrKey) => (k === 'phy' ? -12 : -8);
const mediaPay = (s: GameState) => (s.contract ? Math.round(fameEff(s) * 8) : 0);
const pct = (x: number) => Math.round(x * 100);

export function trainingLabel(s: GameState, t: TrainingDef): string {
  return t.attr ? `${labelOf(s, t.attr)} 훈련` : t.label!;
}
const signed = (n: number) => (n > 0 ? `+${n}` : `−${-n}`);
/** 능력치 훈련의 주력 여부·치우침 배율 — 카드와 자세한 설명이 같이 쓴다. */
function attrInfo(s: GameState, k: AttrKey) {
  const bf = balanceFactor(s, k);
  return { focus: focusOf(s).includes(k), bf, lopsided: bf < 0.95 };
}
/** T-10-074 훈련 카드: 무엇이 오르고 무엇을 치르는지(effect, 항목별)와 눈여겨볼 한 가지(tag — 주력·치우침·비용·수입). */
export function trainingCard(s: GameState, t: TrainingDef): { effect: string[]; tag: string } {
  if (t.id === 'rest')
    return { effect: [`컨디션 ${signed(REST.cond)}`, `사기 ${signed(REST.morale)}`], tag: '' };
  if (t.id === 'coach')
    return {
      effect: ['전 능력 소폭 ▲', `컨디션 ${signed(COACH_COND)}`],
      tag: `비용 ${fmtMoney(coachCost(s))}`,
    };
  if (t.id === 'media') {
    const pay = mediaPay(s);
    return {
      effect: [
        `인기 +${MEDIA.fame[0]}~${MEDIA.fame[1]}`,
        `사기 ${signed(MEDIA.morale)}`,
        `컨디션 ${signed(MEDIA.cond)}`,
      ],
      tag: pay ? `수입 +${fmtMoney(pay)}` : '',
    };
  }
  const k = t.attr!;
  const { focus, bf, lopsided } = attrInfo(s, k);
  const up = k === 'phy' ? `${labelOf(s, k)}·${labelOf(s, 'pac')} ▲` : `${labelOf(s, k)} ▲`;
  const tags = [
    focus ? `주력 성장 +${pct(FOCUS_GROWTH - 1)}%` : '',
    lopsided ? `치우침 성장 −${pct(1 - bf)}%` : '',
  ];
  return { effect: [up, `컨디션 ${signed(trainCond(k))}`], tag: tags.filter(Boolean).join(' · ') };
}
/** T-10-074 고른 훈련의 자세한 설명(카드 아래). 숨은 잠재력 값은 드러내지 않는다. */
export function trainingHelp(s: GameState, t: TrainingDef): string {
  if (t.id === 'rest')
    return `훈련을 쉬고 몸을 추스릅니다. 컨디션이 ${COND_LOW_INJURY} 밑으로 떨어지면 부상 위험이 크게 늘고, ${COND_LOW_START} 밑이면 선발로 나서기 어려워요.`;
  if (t.id === 'coach')
    return 'OVR에 반영되는 능력치가 모두 조금씩 오릅니다. 한 능력치를 집중 훈련하는 것보다 오르는 폭은 작지만 고르게 자라요. 자금이 모자라면 자율 훈련(컨디션 회복)으로 바뀝니다.';
  if (t.id === 'media')
    return `인터뷰·광고로 이름을 알립니다. 인기가 높을수록 대표팀 발탁·이적 제안·광고 제의에 유리해요.${s.contract ? ' 계약 중이라 출연료도 들어옵니다.' : ''}`;
  const k = t.attr!;
  const name = labelOf(s, k);
  const w = wOf(s)[k];
  const { focus, bf, lopsided } = attrInfo(s, k);
  return [
    `${name} 능력치가 크게 오르고, 절반 확률로 다른 능력치도 하나 조금 오릅니다.`,
    k === 'phy' ? `${labelOf(s, 'pac')}도 함께 오르는 대신 컨디션이 더 떨어져요.` : '',
    focus
      ? `주력 능력치라 성장이 ${pct(FOCUS_GROWTH - 1)}% 빠릅니다.`
      : `주력 능력치가 아니라 성장이 ${pct(1 - OFF_FOCUS_GROWTH)}% 느립니다.`,
    lopsided
      ? `다른 핵심 능력치보다 너무 앞서 있어 성장이 ${pct(1 - bf)}% 줄었어요. 다른 능력치를 키우면 다시 풀립니다.`
      : '',
    w < 0.05
      ? `지금 포지션의 OVR에는 거의 반영되지 않아요.`
      : `지금 포지션 OVR에서 ${name} 비중은 ${pct(w)}%예요.`,
  ]
    .filter(Boolean)
    .join(' ');
}
/** 모든 훈련 공통 — 성장 폭을 정하는 요소(값은 숨긴다). */
export const TRAINING_NOTE =
  '성장 폭은 나이가 어릴수록, 잠재력까지 남은 여유가 클수록, 사기가 높을수록 커집니다.';
export function coachCost(s: GameState): number {
  return Math.max(200, Math.round(((s.contract ? s.contract.salary : 0) * 0.06) / 10) * 10);
}

const TRAIN_X = 5 / 3;
/** T-10-042 한 능력치 몰아주기 억제. 훈련하는 능력치가 나머지 핵심 능력치(포지션 가중치 0.1 이상) 평균보다
 * 앞선 정도가 타입 기본형(포지션 기본치 + 주력 보정)보다 BALANCE_KNEE 넘게 커지면, BALANCE_RANGE에 걸쳐 성장이
 * BALANCE_MIN배까지 줄어든다. 타입 개성은 그대로 두고, 슈팅만 올린 공격수가 고르게 키운 선수보다 레전드 점수가
 * 훨씬 높던 것을 뒤집는다. */
const BALANCE_KNEE = 10,
  BALANCE_RANGE = 25;
export const BALANCE_MIN = 0.25;
const leadOf = (pos: Pos, a: Record<AttrKey, number>, k: AttrKey): number => {
  const core = ATTR_KEYS.filter((x) => x !== k && (POS[pos].w[x] ?? 0) >= 0.1);
  return a[k] - core.reduce((t, x) => t + a[x], 0) / core.length;
};
export function balanceFactor(s: GameState, k: AttrKey): number {
  const excess =
    leadOf(s.pos, s.attrs, k) - Math.max(0, leadOf(s.pos, baseline(s.pos, focusOf(s)), k));
  return clamp(1 - (excess - BALANCE_KNEE) / BALANCE_RANGE, BALANCE_MIN, 1);
}
export function applyTraining(s: GameState) {
  const g = growthFactor(s);
  const t = s.training;
  if (t === 'rest') {
    addStat(s, 'cond', REST.cond);
    addStat(s, 'morale', REST.morale);
    return;
  }
  if (t === 'media') {
    addStat(s, 'fame', ri(...MEDIA.fame));
    addStat(s, 'cond', MEDIA.cond);
    addStat(s, 'morale', MEDIA.morale);
    if (s.contract) addStat(s, 'money', mediaPay(s));
    return;
  }
  if (t === 'coach') {
    const c = coachCost(s);
    if (s.money < c) {
      log(s, '자금이 부족해 개인 코치 대신 자율 훈련을 했습니다.');
      s.training = 'rest';
      addStat(s, 'cond', 10);
      return;
    }
    addStat(s, 'money', -c);
    for (const k of ATTR_KEYS) if (wOf(s)[k] > 0.05) addAttr(s, k, (0.6 + rnd()) * g * TRAIN_X);
    addStat(s, 'cond', COACH_COND);
    return;
  }
  addAttr(
    s,
    t as AttrKey,
    (1.6 + rnd() * 2.6) *
      g *
      TRAIN_X *
      (focusOf(s).includes(t as AttrKey) ? FOCUS_GROWTH : OFF_FOCUS_GROWTH) *
      balanceFactor(s, t as AttrKey),
  );
  if (t === 'phy') addAttr(s, 'pac', rnd() * g * TRAIN_X);
  if (chance(0.5)) addAttr(s, pick(ATTR_KEYS), rnd() * g * TRAIN_X);
  addStat(s, 'cond', trainCond(t as AttrKey));
}
