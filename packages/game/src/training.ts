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
import { ovr, wOf, mainRole, ROLES, faceOf, SUBS, maxedShare } from './attributes.js';
import { clamp, ri, pick, chance, rnd } from './rng.js';
import { baseline } from './candidates.js';
import { BAL } from './balance.js';
import type { GameState } from './types.js';
import { focusOf, labelOf, fmtMoney } from './player.js';
import { truePot, addAttr, addStat, fameEff, log } from './stats.js';
import { gTrainingText as L } from './i18n/ko/gTraining.js';

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
  {
    id: 'rest',
    get label() {
      return L.rest;
    },
  },
  {
    id: 'coach',
    get label() {
      return L.coach;
    },
  },
  {
    id: 'media',
    get label() {
      return L.media;
    },
  },
];
/** applyTraining과 같은 숫자 — 설명과 실제 효과가 어긋나지 않게 한곳에 둔다. */
const REST = { cond: 30, morale: 4 };
const MEDIA = { fame: [5, 9] as const, cond: -5, morale: 3 };
const COACH_COND = -6;
const trainCond = (k: AttrKey) => (k === 'phy' ? -12 : -8);
const mediaPay = (s: GameState) => (s.contract ? Math.round(fameEff(s) * 8) : 0);
const pct = (x: number) => Math.round(x * 100);

export function trainingLabel(s: GameState, t: TrainingDef): string {
  return t.attr ? L.attrTraining({ attr: labelOf(s, t.attr) }) : t.label!;
}
const signed = (n: number) => (n > 0 ? `+${n}` : `−${-n}`);
/** 능력치 훈련의 주력 여부·치우침 배율 — 카드와 자세한 설명이 같이 쓴다. */
function attrInfo(s: GameState, k: AttrKey) {
  const bf = balanceFactor(s, k);
  return { focus: focusOf(s).includes(k), bf, lopsided: bf < 0.95 };
}
/** T-11-183 최고치(세부 능력치 99) 알림 — 다 찼으면 '최고치 도달', 성장의 5% 넘게 버려지면 그 몫. 카드 태그·설명이 같이 쓴다. */
function maxNote(s: GameState, k: AttrKey): { maxed: boolean; tag: string; help: string } {
  const lost = maxedShare(s, k);
  if (lost > 0.999) {
    const attr = labelOf(s, k);
    return { maxed: true, tag: L.maxed({ attr }), help: L.helpMaxed({ attr }) };
  }
  if (lost < 0.05) return { maxed: false, tag: '', help: '' };
  return {
    maxed: false,
    tag: L.nearMax({ pct: pct(lost) }),
    help: L.helpNearMax({ pct: pct(lost) }),
  };
}
/** T-10-074 훈련 카드: 무엇이 오르고 무엇을 치르는지(effect, 항목별)와 눈여겨볼 한 가지(tag — 주력·너무 앞섬·비용·수입). */
export function trainingCard(s: GameState, t: TrainingDef): { effect: string[]; tag: string } {
  if (t.id === 'rest')
    return {
      effect: [L.condition({ v: signed(REST.cond) }), L.morale({ v: signed(REST.morale) })],
      tag: '',
    };
  if (t.id === 'coach')
    return {
      effect: [L.allAttrsUp, L.condition({ v: signed(COACH_COND) })],
      tag: L.cost({ money: fmtMoney(coachCost(s)) }),
    };
  if (t.id === 'media') {
    const pay = mediaPay(s);
    return {
      effect: [
        L.fameRange({ lo: MEDIA.fame[0], hi: MEDIA.fame[1] }),
        L.morale({ v: signed(MEDIA.morale) }),
        L.condition({ v: signed(MEDIA.cond) }),
      ],
      tag: pay ? L.income({ money: fmtMoney(pay) }) : '',
    };
  }
  const k = t.attr!;
  const { focus, bf, lopsided } = attrInfo(s, k);
  const max = maxNote(s, k);
  const up =
    k === 'phy'
      ? L.attrPairUp({ a: labelOf(s, k), b: labelOf(s, 'pac') })
      : L.attrUp({ attr: labelOf(s, k) });
  // 다 찬 능력치에 성장 보정 태그를 붙이면 오를 것처럼 보인다 — 최고치 태그만 남긴다.
  const tags = max.maxed
    ? [max.tag]
    : [
        focus ? L.focusGrowth({ pct: pct(FOCUS_GROWTH - 1) }) : '',
        lopsided ? L.tooFarAhead({ pct: pct(1 - bf) }) : '',
        max.tag,
      ];
  return {
    effect: [up, L.condition({ v: signed(trainCond(k)) })],
    tag: tags.filter(Boolean).join(' · '),
  };
}
/** T-10-074 고른 훈련의 자세한 설명(카드 아래). 숨은 잠재력 값은 드러내지 않는다. */
export function trainingHelp(s: GameState, t: TrainingDef): string {
  if (t.id === 'rest') return L.helpRest({ low: COND_LOW_INJURY, start: COND_LOW_START });
  if (t.id === 'coach') return L.helpCoach;
  if (t.id === 'media') return L.helpMedia({ contract: !!s.contract });
  const k = t.attr!;
  const name = labelOf(s, k);
  const w = wOf(s)[k];
  const { focus, bf, lopsided } = attrInfo(s, k);
  const weights = ROLES[mainRole(s)]!;
  const subs = Object.keys(faceOf(s)[k]!)
    .filter((key) => (weights[key] ?? 0) > 0)
    .sort((a, b) => weights[b]! - weights[a]!)
    .map((key) => SUBS[key])
    .join(' · ');
  return [
    L.helpAttrMain({ attr: name }),
    subs ? L.helpOvrSubs({ list: subs }) : L.helpOvrSeparate,
    k === 'phy' ? L.helpPhy({ pac: labelOf(s, 'pac') }) : '',
    focus
      ? L.helpFocus({ pct: pct(FOCUS_GROWTH - 1) })
      : L.helpOffFocus({ pct: pct(1 - OFF_FOCUS_GROWTH) }),
    lopsided ? L.helpLopsided({ pct: pct(1 - bf) }) : '',
    maxNote(s, k).help,
    w < 0.05 ? L.helpWeightLow : L.helpWeight({ attr: name, pct: pct(w) }),
  ]
    .filter(Boolean)
    .join(' ');
}
/** 연봉 비례 비용(만 원, 10 단위) — 최소 금액이 있어 아마추어·저연봉도 0이 아니다. 개인 코치·자기 투자가 같이 쓴다. */
export const salaryCost = (s: GameState, rate: number, min: number, mult = 1) =>
  Math.round((Math.max(min, (s.contract ? s.contract.salary : 0) * rate) * mult) / 10) * 10;
export function coachCost(s: GameState): number {
  return salaryCost(s, 0.06, 200);
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
/** 능력치 훈련 한 번의 주 능력치 성장 — 자기 투자 특훈도 같은 공식에 배율만 곱한다. */
const attrGain = (s: GameState, k: AttrKey, g: number) =>
  (1.6 + rnd() * 2.6) *
  g *
  TRAIN_X *
  (focusOf(s).includes(k) ? FOCUS_GROWTH : OFF_FOCUS_GROWTH) *
  balanceFactor(s, k);
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
      log(s, L.coachBroke);
      s.training = 'rest';
      addStat(s, 'cond', 10);
      return;
    }
    addStat(s, 'money', -c);
    for (const k of ATTR_KEYS) if (wOf(s)[k] > 0.05) addAttr(s, k, (0.6 + rnd()) * g * TRAIN_X);
    addStat(s, 'cond', COACH_COND);
    return;
  }
  addAttr(s, t as AttrKey, attrGain(s, t as AttrKey, g));
  if (t === 'phy') addAttr(s, 'pac', rnd() * g * TRAIN_X);
  if (chance(0.5)) addAttr(s, pick(ATTR_KEYS), rnd() * g * TRAIN_X);
  addStat(s, 'cond', trainCond(t as AttrKey));
}

// ───────── T-11-012 자기 투자 ─────────
// 훈련과 따로 구간마다 자금을 한 가지에 쓴다. 비용은 연봉 비례(최소 금액이 있어 아마추어·저연봉도 의미가 있다)이고,
// 특훈 성장은 능력치 훈련과 같은 공식(나이·잠재력까지 남은 여유·사기·치우침)을 타서 돈으로 잠재력을 넘지 못한다.
// 고르지 않은 커리어(invest 없음)는 RNG를 한 번도 쓰지 않는다 — 기존 시드 결과(golden.test.ts)가 그대로다.
export type InvestId = 'none' | 'weak' | 'best' | 'medical' | 'mental';
export interface InvestDef {
  id: InvestId;
  label: string;
  /** 비용 = max(min, 연봉 × rate) × 밸런스 배율(만 원). */
  rate: number;
  min: number;
}
export const INVESTS: InvestDef[] = [
  {
    id: 'none',
    get label() {
      return L.investNone;
    },
    rate: 0,
    min: 0,
  },
  {
    id: 'weak',
    get label() {
      return L.investWeak;
    },
    rate: 0.1,
    min: 300,
  },
  {
    id: 'best',
    get label() {
      return L.investBest;
    },
    rate: 0.1,
    min: 300,
  },
  {
    id: 'medical',
    get label() {
      return L.investMedical;
    },
    rate: 0.06,
    min: 200,
  },
  {
    id: 'mental',
    get label() {
      return L.investMental;
    },
    rate: 0.04,
    min: 150,
  },
];
const SPECIAL_COND = -3;
const MEDICAL = { cond: 15, injury: 3 };
const MENTAL_MORALE = 10;

/** 고른 투자(없거나 모르는 값이면 '투자 안 함'). */
export const investDef = (s: GameState): InvestDef =>
  INVESTS.find((d) => d.id === s.invest) ?? INVESTS[0]!;
export const investCost = (s: GameState, d: InvestDef): number =>
  salaryCost(s, d.rate, d.min, BAL.investCost);
/** 특훈이 올릴 능력치 — 지금 포지션의 핵심 능력치(가중치 0.1 이상) 중 가장 낮은 것 / 가장 높은 것. */
export function investTarget(s: GameState, id: 'weak' | 'best'): AttrKey {
  const w = wOf(s);
  const core = ATTR_KEYS.filter((k) => (w[k] ?? 0) >= 0.1);
  return core.reduce((a, b) =>
    (id === 'weak' ? s.attrs[b] < s.attrs[a] : s.attrs[b] >= s.attrs[a]) ? b : a,
  );
}
function investEffect(s: GameState, id: InvestId): string[] {
  if (id === 'none') return [L.investSaveMoney];
  if (id === 'medical')
    return [
      L.condition({ v: `+${MEDICAL.cond}` }),
      L.investMedicalInjury({ games: MEDICAL.injury }),
    ];
  if (id === 'mental') return [L.morale({ v: `+${MENTAL_MORALE}` })];
  return [
    L.attrUp({ attr: labelOf(s, investTarget(s, id)) }),
    L.condition({ v: signed(SPECIAL_COND) }),
  ];
}
/** 카드 한 장: 효과(항목별)와 비용 태그. 자금이 모자라면 affordable=false(화면이 버튼을 막는다)·태그 '자금 부족'. */
export function investCard(
  s: GameState,
  d: InvestDef,
): { effect: string[]; tag: string; affordable: boolean } {
  const cost = investCost(s, d);
  const affordable = s.money >= cost;
  const money = !cost ? '' : affordable ? L.cost({ money: fmtMoney(cost) }) : L.investShort;
  const k = d.id === 'weak' || d.id === 'best' ? investTarget(s, d.id) : null;
  const tag = [money, k ? maxNote(s, k).tag : ''].filter(Boolean).join(' · ');
  return { effect: investEffect(s, d.id), tag, affordable };
}
export function investHelp(s: GameState, d: InvestDef): string {
  if (d.id === 'none') return L.helpInvestNone;
  if (d.id === 'medical') return L.helpInvestMedical({ games: MEDICAL.injury });
  if (d.id === 'mental') return L.helpInvestMental;
  const k = investTarget(s, d.id);
  const name = labelOf(s, k);
  const { bf, lopsided } = attrInfo(s, k);
  return [
    d.id === 'weak' ? L.helpInvestWeak({ attr: name }) : L.helpInvestBest({ attr: name }),
    L.helpInvestGain({ pct: pct(BAL.investGain) }),
    lopsided ? L.helpInvestLopsided({ pct: pct(1 - bf) }) : '',
    maxNote(s, k).help,
    L.helpInvestSkip,
  ]
    .filter(Boolean)
    .join(' ');
}
/** 훈련 다음, 경기 전에 적용한다(turn.ts playPhase). */
export function applyInvest(s: GameState) {
  const d = investDef(s);
  const id = d.id;
  if (id === 'none') return;
  const cost = investCost(s, d);
  if (s.money < cost) {
    log(s, L.investBroke({ label: d.label }));
    s.invest = 'none';
    return;
  }
  addStat(s, 'money', -cost);
  if (id === 'medical') {
    addStat(s, 'cond', MEDICAL.cond);
    if (s.injury > 0) s.injury = Math.max(0, s.injury - MEDICAL.injury);
    return;
  }
  if (id === 'mental') {
    addStat(s, 'morale', MENTAL_MORALE);
    return;
  }
  const k = investTarget(s, id);
  addAttr(s, k, attrGain(s, k, growthFactor(s)) * BAL.investGain);
  addStat(s, 'cond', SPECIAL_COND);
}
