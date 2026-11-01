// ───────── 단계별 선수 만들기 (T-11-605) ─────────
// 웹 Create.svelte · 앱 screens/create/Create.tsx가 함께 쓰는 단계 순서 · 입력 검사 · 후보 비교 문구. 화면 표시만 하고
// 게임 상태 · 난수 · 저장은 건드리지 않는다. 체격 · 주발 · 외형(extra)은 정보 단계에서 들어가는 선택 단계다.
import { BODY_LIMITS } from '@offside/contracts/body';
import { DETAILS_OF, type DetailPos, type PosGroup } from '@offside/contracts/positions';
import {
  ATTR_KEYS,
  attrLabels,
  DPOS,
  FOCUS_PICK,
  POS,
  TRAITS,
  type AttrKey,
  type Pos,
} from '@offside/game/data';
import { createText as L } from './i18n/ko/create.js';
import type { CreateStep, DraftCharacter } from './state.js';

export type { CreateStep };

/** 진행 표시 순서. 마지막은 후보 고르기(appState.candidates가 있을 때)다. */
export const CREATE_PROGRESS = ['pos', 'focus', 'trait', 'info', 'candidates'] as const;
export type CreateProgress = (typeof CREATE_PROGRESS)[number];

const FORM_ORDER: readonly CreateStep[] = ['pos', 'focus', 'trait', 'info'];

/** 다음 입력 단계. 정보 · 더 꾸미기 다음은 후보 보기라 null. */
export function nextCreateStep(step: CreateStep): CreateStep | null {
  const i = FORM_ORDER.indexOf(step);
  return i < 0 ? null : (FORM_ORDER[i + 1] ?? null);
}

/** 이전 입력 단계. 첫 단계면 null(화면에서 나간다). */
export function prevCreateStep(step: CreateStep): CreateStep | null {
  if (step === 'extra') return 'info';
  return FORM_ORDER[FORM_ORDER.indexOf(step) - 1] ?? null;
}

/** 진행 표시에서 지금 칸. 더 꾸미기는 정보 단계에 속한다. */
export const createProgressAt = (step: CreateStep, candidates: boolean): CreateProgress =>
  candidates ? 'candidates' : step === 'extra' ? 'info' : step;

/** 적은 등번호가 범위를 벗어났는지. 비어 있으면(null · 빈 칸) 시작할 때 랜덤으로 정하므로 괜찮다. */
export function numberInvalid(n: number | string | null | undefined): boolean {
  if (n === null || n === undefined || n === '') return false;
  const v = +n;
  return !Number.isInteger(v) || v < 1 || v > 99;
}

/** 세부 포지션 한 줄 설명. 같은 계열이어도 자리마다 다르다. 첫 화면 번들에 싣지 않으려 엔진 사전 대신 만들기 사전에 둔다. */
export function detailBlurb(d: DetailPos): string {
  switch (d) {
    case 'CF':
    case 'SS':
    case 'LW':
    case 'RW':
    case 'LM':
    case 'RM':
    case 'LB':
    case 'RB':
    case 'LWB':
    case 'RWB':
    case 'SW':
      return L[`blurb${d}`];
    default:
      return DPOS[d].blurb;
  }
}

const level = (m: number) => (m > 1.02 ? L.levelHigh : m < 0.98 ? L.levelLow : L.levelMid);

/** 세부 포지션의 골 · 도움 비중 한 줄. 같은 라인(공격수 · 미드필더 · 수비수) 평균과 비교한다. 세부 포지션을 고르기 전이면 빈 문자열. */
export function positionTendency(pos: Pos, dpos: DetailPos | null | undefined): string {
  if (pos === 'GK') return L.tendencyGk;
  if (!dpos) return '';
  return L.tendencyLine({ goal: level(DPOS[dpos].goal), assist: level(DPOS[dpos].assist) });
}

/** 세 후보 중 이 후보가 가장 앞서는 능력치 한 줄. 표시 값(반올림)으로 비교하고, 앞서는 능력치가 없으면 그렇다고 말한다. */
export function candidateEdge(
  pos: Pos,
  list: readonly { attrs: Record<AttrKey, number> }[],
  i: number,
): string {
  const me = list[i]!.attrs;
  let best: AttrKey | null = null;
  let lead = 0;
  for (const k of ATTR_KEYS) {
    const others = list.filter((_, j) => j !== i).map((c) => Math.round(c.attrs[k]));
    const d = Math.round(me[k]) - Math.max(...others);
    if (d > lead) {
      lead = d;
      best = k;
    }
  }
  return best ? L.candEdge({ k: attrLabels(pos)[best] }) : L.candEdgeEven;
}

/** 새로 고침 뒤 이어 쓸 입력. 형식이 어긋난 값은 버려 기본값으로 둔다(저장소 값을 그대로 믿지 않는다). */
export function parseCreateDraft(
  raw: unknown,
): { draft: Partial<DraftCharacter>; step: CreateStep } | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = raw as Record<string, unknown>;
  const c = v.C as Partial<Record<keyof DraftCharacter, unknown>> | undefined;
  if (!c || typeof c !== 'object' || typeof c.pos !== 'string' || !(c.pos in POS)) return null;
  const pos = c.pos as Pos;
  const draft: Partial<DraftCharacter> = { pos };
  if (typeof c.name === 'string') draft.name = c.name.slice(0, 12);
  if (c.number === null || typeof c.number === 'number') draft.number = c.number as number;
  if (typeof c.dpos === 'string' && DETAILS_OF[pos as PosGroup].includes(c.dpos as DetailPos))
    draft.dpos = c.dpos as DetailPos;
  if (c.foot === '오른발' || c.foot === '왼발' || c.foot === '양발') draft.foot = c.foot; // i18n-ignore 저장값
  if (
    Array.isArray(c.focus) &&
    c.focus.length <= FOCUS_PICK &&
    c.focus.every((k) => ATTR_KEYS.includes(k as AttrKey))
  )
    draft.focus = c.focus as AttrKey[];
  if (typeof c.trait === 'string' && TRAITS.some((t) => t.id === c.trait)) draft.trait = c.trait;
  if (typeof c.nation === 'string') draft.nation = c.nation;
  const inRange = (n: unknown, r: { min: number; max: number }) =>
    n === null || (typeof n === 'number' && n >= r.min && n <= r.max);
  if (inRange(c.height, BODY_LIMITS.height)) draft.height = c.height as number | null;
  if (inRange(c.weight, BODY_LIMITS.weight)) draft.weight = c.weight as number | null;
  if (c.look && typeof c.look === 'object') draft.look = c.look as DraftCharacter['look'];
  if (typeof c.cid === 'string') draft.cid = c.cid;
  const step = (['pos', 'focus', 'trait', 'info', 'extra'] as const).find((s) => s === v.step);
  return { draft, step: step ?? 'pos' };
}
