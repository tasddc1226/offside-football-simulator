import { POS, ATTR_KEYS, FOCUS_GROWTH, OFF_FOCUS_GROWTH, type AttrKey, type Pos } from './data.js';
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
  desc?: string;
}
export const TRAININGS: TrainingDef[] = [
  ...ATTR_KEYS.map((k) => ({ id: k, attr: k })),
  { id: 'rest', label: '휴식·회복', desc: '컨디션 대폭 회복' },
  { id: 'coach', label: '개인 코치', desc: '전 능력 소폭 ▲ · 비용' },
  { id: 'media', label: '미디어 활동', desc: '인기 ▲ · 컨디션 ▼' },
];
export function trainingLabel(s: GameState, t: TrainingDef): string {
  return t.attr ? `${labelOf(s, t.attr)} 훈련` : t.label!;
}
export function trainingDesc(s: GameState, t: TrainingDef): string {
  if (t.id === 'coach') return `비용 ${fmtMoney(coachCost(s))}`;
  if (!t.attr) return t.desc!;
  const main = focusOf(s).includes(t.attr) ? `주력 · 성장 +${Math.round((FOCUS_GROWTH - 1) * 100)}% · ` : '';
  const bf = balanceFactor(s, t.attr);
  const lop = bf < 0.95 ? `치우침 · 성장 −${Math.round((1 - bf) * 100)}% · ` : '';
  return `${main}${lop}${labelOf(s, t.attr)} 집중 성장 · OVR 반영 ${Math.round(wOf(s)[t.attr] * 100)}%`;
}
export function coachCost(s: GameState): number {
  return Math.max(200, Math.round(((s.contract ? s.contract.salary : 0) * 0.06) / 10) * 10);
}

const TRAIN_X = 5 / 3;
/** T-10-042 한 능력치 몰아주기 억제. 훈련하는 능력치가 나머지 핵심 능력치(포지션 가중치 0.1 이상) 평균보다
 * 앞선 정도가 타입 기본형(포지션 기본치 + 주력 보정)보다 BALANCE_KNEE 넘게 커지면, BALANCE_RANGE에 걸쳐 성장이
 * BALANCE_MIN배까지 줄어든다. 타입 개성은 그대로 두고, 슈팅만 올린 공격수가 고르게 키운 선수보다 레전드 점수가
 * 훨씬 높던 것을 뒤집는다. */
const BALANCE_KNEE = 10, BALANCE_RANGE = 25;
export const BALANCE_MIN = 0.25;
const leadOf = (pos: Pos, a: Record<AttrKey, number>, k: AttrKey): number => {
  const core = ATTR_KEYS.filter((x) => x !== k && (POS[pos].w[x] ?? 0) >= 0.1);
  return a[k] - core.reduce((t, x) => t + a[x], 0) / core.length;
};
export function balanceFactor(s: GameState, k: AttrKey): number {
  const excess = leadOf(s.pos, s.attrs, k) - Math.max(0, leadOf(s.pos, baseline(s.pos, focusOf(s)), k));
  return clamp(1 - (excess - BALANCE_KNEE) / BALANCE_RANGE, BALANCE_MIN, 1);
}
export function applyTraining(s: GameState) {
  const g = growthFactor(s);
  const t = s.training;
  if (t === 'rest') {
    addStat(s, 'cond', 30);
    addStat(s, 'morale', 4);
    return;
  }
  if (t === 'media') {
    addStat(s, 'fame', ri(5, 9));
    addStat(s, 'cond', -5);
    addStat(s, 'morale', 3);
    if (s.contract) addStat(s, 'money', Math.round(fameEff(s) * 8));
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
    addStat(s, 'cond', -6);
    return;
  }
  addAttr(s, t as AttrKey, (1.6 + rnd() * 2.6) * g * TRAIN_X * (focusOf(s).includes(t as AttrKey) ? FOCUS_GROWTH : OFF_FOCUS_GROWTH) * balanceFactor(s, t as AttrKey));
  if (t === 'phy') addAttr(s, 'pac', rnd() * g * TRAIN_X);
  if (chance(0.5)) addAttr(s, pick(ATTR_KEYS), rnd() * g * TRAIN_X);
  addStat(s, 'cond', t === 'phy' ? -12 : -8);
}

