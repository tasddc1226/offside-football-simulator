// T-11-373 카드 강화 창(웹 team/EnhanceSheet.svelte · 앱 screens/owner/EnhanceSheet.tsx)이 그리는 값. 확률 · 비용 · 강화 OVR은
// contracts card-enhance.ts(서버 판정과 같은 식)에서, 운영 수치와 카드 상태는 GET /v1/cards/:careerId/enhance에서 온다.
import {
  ENHANCE_MAX,
  enhanceCost,
  enhanceDownBp,
  enhanceOvr,
  enhanceRateBp,
  enhanceTierRules,
  enhanceExpectedCost,
  enhanceValue,
  type EnhanceAutoStop,
  type EnhanceCardState,
  type EnhanceRules,
} from '@offside/contracts/card-enhance';
import type { EnhanceAutoBody, EnhanceAutoResponse, EnhanceBody } from '@offside/contracts';
import type { ApiResult } from './api/client.js';
import { fmtValue } from './format.js';
import { titleLabel } from './ownerTitle.js';
import { cardEnhanceText as L } from './i18n/ko/cardEnhance.js';

/** 카드 배지 — 강화 전이면 null. */
export const enhanceBadge = (level: number | null | undefined) => (level ? `+${level}` : null);

/** 단계별 효과 이름(+1 잔디 ~ +10 마지막 휘슬). */
export const enhanceFxName = (level: number): string =>
  [L.fx1, L.fx2, L.fx3, L.fx4, L.fx5, L.fx6, L.fx7, L.fx8, L.fx9, L.fx10][level - 1] ?? '';

export type EnhanceView = {
  level: number;
  next: number | null;
  /** 이번 시도 성공 · 유지 · 실패 확률(정수 퍼센트 문구). */
  ratePct: string;
  keepPct: string;
  downPct: string;
  /** 레전드 · 아이콘 카드의 확률 안내(그 밖에는 null). */
  tierText: string | null;
  /** 실패하면 어떻게 되는지(+10이면 null). */
  failText: string | null;
  cost: number | null;
  costText: string;
  /** 강화 OVR 지금 → 성공하면. */
  ovrText: string | null;
  /** 성공하면 입는 효과 이름 안내(+10이면 지금 효과). */
  fxText: string;
  /** 시도를 막는 이유(없으면 null). */
  block: string | null;
  /** 서버에 보낼 본 값(시도할 수 있을 때만). */
  body: EnhanceBody | null;
};

export function enhanceView(
  card: EnhanceCardState,
  rules: EnhanceRules,
  balance: number,
  listed = false,
): EnhanceView {
  const { level, fails, tier } = card;
  const odds = enhanceTierRules(rules, tier);
  const cost = enhanceCost(level, rules);
  const rateBp = enhanceRateBp(level, odds);
  const downBp = enhanceDownBp(level, odds);
  const next = level < ENHANCE_MAX ? level + 1 : null;
  const block =
    next === null
      ? L.max
      : !rules.open
        ? L.closed
        : listed
          ? L.listed
          : cost !== null && balance < cost
            ? L.short
            : null;
  return {
    level,
    next,
    ratePct: `${rateBp / 100}%`,
    keepPct: `${(10_000 - rateBp - downBp) / 100}%`,
    downPct: `${downBp / 100}%`,
    tierText: next === null || tier === 'normal' ? null : tier === 'top' ? L.tierTop : L.tierHigh,
    failText: next === null ? null : downBp > 0 ? L.failNote({ lv: level - 1 }) : L.failSafe,
    cost,
    costText: cost === null ? '-' : fmtValue(cost),
    ovrText: next === null ? null : L.ovr({ now: enhanceOvr(level), next: enhanceOvr(next) }),
    fxText: enhanceFxName(next ?? level),
    block,
    body: block === null && cost !== null ? { level, fails, cost, rateBp, downBp } : null,
  };
}

/** 강화 충전 연출 시간. 응답이 먼저 와도 이만큼은 채운 뒤 결과를 보여 준다(동작 줄이기면 건너뛴다). */
export const ENHANCE_CHARGE_MS = 900;

/** 높은 단계 성공은 연출을 더 크게 한다. */
export const enhanceFxBig = (r: { success: boolean; to: number }) => r.success && r.to >= 7;

/** 결과 연출 길이(ms). */
export const enhanceFxMs = (r: { success: boolean; from: number; to: number }) => {
  if (enhanceFxBig(r)) return 1800;
  const kind = enhanceResultKind(r);
  return kind === 'success' ? 1300 : kind === 'down' ? 1100 : 800;
};

/** 결과 연출 큰 글자. */
export const enhanceFxLabel = (r: { success: boolean; from: number; to: number }) => {
  const kind = enhanceResultKind(r);
  return kind === 'success' ? L.fxSuccess : kind === 'down' ? L.fxDown : L.fxKeep;
};

/** 연출 입자 배치(웹 · 앱 공통, 고정값이라 게임 난수를 쓰지 않는다). dist는 0.55~1, delay는 0~1 비율. */
export const enhanceParticles = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    angle: (i * 360) / n + ((i * 47) % 17),
    dist: 0.55 + ((i * 37) % 46) / 100,
    size: 4 + ((i * 3) % 7),
    delay: ((i * 53) % 100) / 100,
  }));

/** 시도 결과 한 줄. */
export const enhanceResultText = (r: { success: boolean; from: number; to: number }) =>
  r.success
    ? L.success({ lv: r.to })
    : r.to < r.from
      ? L.failDown({ from: r.from, to: r.to })
      : L.failKeep({ lv: r.to });

/** 결과 종류(화면 표시 · 테스트 표식). */
export const enhanceResultKind = (r: { success: boolean; from: number; to: number }) =>
  r.success ? 'success' : r.to < r.from ? 'down' : 'keep';

/** 새로 받은 칭호 안내(없으면 null). */
export const enhanceTitleText = (titles: readonly string[] | undefined) =>
  titles?.length ? L.newTitle({ names: titles.map(titleLabel).join(', ') }) : null;

/** 판매 시트 안내: 강화 가치가 판매 가격 범위에 더해진다(강화 전이면 null). */
export const enhanceSellNote = (level: number | null | undefined) =>
  level ? L.sellNote({ lv: level, value: fmtValue(enhanceValue(level)) }) : null;

/**
 * 자리 OVR을 카드에 따로 보일지. 제 자리가 아닐 때만 보인다. 강화 OVR을 뺀 값으로 재서, 강화 덕에 최고 OVR과 숫자가 같아진 경우도 제 자리가 아니면 보인다.
 * (웹 team/PlayerCard.svelte · 앱 components/PlayerCard.tsx)
 */
export const showsPosOvr = (peak: number, posOvr: number, level: number | null | undefined) =>
  posOvr - (level ?? 0) !== peak;

/** 방출 · 카드 과제 확인 문구: 강화한 선수가 있으면 단계와 강화에 쓴 자금이 함께 사라진다고 알린다(없으면 null). */
export function enhanceLossNote(players: readonly { enhance?: number | null | undefined }[]) {
  const n = players.filter((p) => p.enhance).length;
  return n ? L.lossNote({ n }) : null;
}

/** 서버 거절 이유를 창 문구로(모르는 이유는 서버 문구를 그대로). */
export function enhanceErrorText(e: { reason?: string | undefined; message?: string }): string {
  switch (e.reason) {
    case 'FUNDS_SHORT':
      return L.short;
    case 'ENHANCE_CLOSED':
      return L.closed;
    case 'ENHANCE_MAX':
      return L.max;
    case 'CARD_LISTED':
      return L.listed;
    case 'ENHANCE_STALE':
      return L.stale;
    case 'ENHANCE_AUTO_TARGET':
      return L.autoTargetLow;
    case 'ENHANCE_AUTO_BUDGET':
      return L.autoBudgetLow;
    default:
      return e.message || L.tryFail;
  }
}

/** 응답을 받지 못한 시도(네트워크 · 일시 오류)는 같은 멱등 키로 다시 보낸다. 그 밖의 거절은 키를 새로 만든다. */
export const enhanceKeepKey = (e: { code?: string; retryable?: boolean }) => !!e.retryable;

// ───────── T-11-679 자동 강화 ─────────
// 목표 단계 · 쓸 금액을 고르면 서버가 연달아 판정한다(요청 하나에 ENHANCE_AUTO_CHUNK번까지, 'more'면 남은 금액으로 이어서 보낸다).
// 멈추는 조건은 셋이다: 목표 단계 달성 · 자금이 다음 시도 비용보다 적음 · 쓸 금액 상한. 유저가 누르는 멈추기는 요청 사이에서 멈춘다.

/** 목표로 고를 수 있는 단계(지금 다음 단계 ~ +10). */
export const enhanceAutoTargets = (level: number) =>
  Array.from({ length: Math.max(0, ENHANCE_MAX - level) }, (_, i) => level + 1 + i);

/** 지금 단계에서 목표까지 기대 비용(만 원) — 이 카드 구간 확률로, 내려간 단계를 다시 올리는 몫까지 넣는다. */
export function enhanceAutoExpected(
  card: Pick<EnhanceCardState, 'level' | 'tier'>,
  target: number,
  rules: EnhanceRules,
) {
  const odds = enhanceTierRules(rules, card.tier);
  return Math.max(
    0,
    Math.round(enhanceExpectedCost(target, odds).cost - enhanceExpectedCost(card.level, odds).cost),
  );
}

export type EnhanceAutoBudget = { value: number; label: string };

/** 기대 비용 배수 */
const AUTO_MULTS = [1, 1.5, 2, 3] as const;
/** 1억(만 원) 단위로 올린다. */
const ceilEok = (v: number) => Math.ceil(v / 10_000) * 10_000;

/**
 * 쓸 금액 후보: 기대 비용의 1 · 1.5 · 2 · 3배(1억 단위로 올림)와 가진 자금 전부. 가진 자금을 넘거나 한 번 시도할 비용보다 적은 값은
 * 뺀다. 고른 값이 기본(1.5배, 없으면 가진 자금 전부)이다.
 */
export function enhanceAutoBudgets(
  expected: number,
  balance: number,
  firstCost: number,
): { list: EnhanceAutoBudget[]; pick: number } {
  const seen = new Set<number>();
  const list: EnhanceAutoBudget[] = [];
  for (const m of AUTO_MULTS) {
    const v = ceilEok(expected * m);
    if (v < firstCost || v >= balance || seen.has(v)) continue;
    seen.add(v);
    list.push({ value: v, label: L.autoBudgetMult({ value: fmtValue(v), mult: String(m) }) });
  }
  if (balance >= firstCost)
    list.push({ value: balance, label: L.autoBudgetAll({ value: fmtValue(balance) }) });
  const half = list.find((b) => b.value === ceilEok(expected * 1.5));
  return { list, pick: (half ?? list.at(-1))?.value ?? 0 };
}

export type EnhanceAutoRun = {
  tries: number;
  up: number;
  keep: number;
  down: number;
  spent: number;
  balance: number;
  card: EnhanceCardState;
  stop: EnhanceAutoStop | 'user' | 'error' | null;
  titles: string[];
  error: string | null;
};

/**
 * 자동 강화를 끝까지 돌린다(웹 · 앱 공용). 요청마다 새 멱등 키를 쓰고, 응답을 받지 못한 요청은 같은 키로 두 번까지 다시 보낸다.
 * 'more'면 남은 금액으로 이어서 보내고, cancelled()가 참이면 다음 요청을 보내지 않는다. onChunk는 요청이 끝날 때마다 부른다.
 */
export async function runEnhanceAuto(o: {
  start: EnhanceCardState;
  target: number;
  budget: number;
  balance: number;
  send: (body: EnhanceAutoBody, key: string) => Promise<ApiResult<EnhanceAutoResponse>>;
  newKey: () => string;
  cancelled: () => boolean;
  /** 요청 하나가 끝날 때마다. tries는 그 요청에서 판정된 시도(화면이 단계 숫자를 차례로 되감아 보여 준다). */
  onChunk?: (run: EnhanceAutoRun, tries: EnhanceAutoResponse['tries']) => void;
}): Promise<EnhanceAutoRun> {
  const run: EnhanceAutoRun = {
    tries: 0,
    up: 0,
    keep: 0,
    down: 0,
    spent: 0,
    balance: o.balance,
    card: o.start,
    stop: null,
    titles: [],
    error: null,
  };
  for (;;) {
    const body: EnhanceAutoBody = {
      level: run.card.level,
      fails: run.card.fails,
      target: o.target,
      budget: o.budget - run.spent,
    };
    const key = o.newKey();
    let r = await o.send(body, key);
    for (let retry = 0; !r.ok && r.error.retryable && retry < 2; retry++)
      r = await o.send(body, key);
    if (!r.ok) {
      run.stop = 'error';
      run.error = enhanceErrorText(r.error);
      break;
    }
    const d = r.data;
    for (const t of d.tries) {
      const kind = enhanceResultKind(t);
      run[kind === 'success' ? 'up' : kind]++;
    }
    run.tries += d.tries.length;
    run.spent += d.spent;
    run.balance = d.balance;
    run.card = d.card;
    if (d.titles?.length) run.titles.push(...d.titles);
    o.onChunk?.(run, d.tries);
    if (d.stop !== 'more') {
      run.stop = d.stop;
      break;
    }
    if (o.cancelled()) {
      run.stop = 'user';
      break;
    }
  }
  return run;
}

/**
 * T-11-682 자동 강화 되감기: 서버가 한꺼번에 판정한 시도를 단계 숫자로 차례로 보여 줄 때 한 칸 간격(ms). 한 칸이 눈으로 읽히도록
 * 80ms보다 빨라지지 않고(100번 묶음이면 8초), 시도가 적으면 한 칸에 0.32초까지 머문다.
 */
export const enhanceAutoTickMs = (n: number) =>
  Math.min(320, Math.max(80, Math.round(4000 / Math.max(1, n))));

/** 자동 강화가 끝났을 때 결과 연출에 넘길 값: 시작 단계에서 끝 단계로 한 번 강화한 것처럼(올랐으면 성공, 그대로면 유지, 내려갔으면 하락). */
export const enhanceAutoFinal = (run: EnhanceAutoRun, from: number) => ({
  success: run.card.level > from,
  from,
  to: run.card.level,
  cost: run.spent,
  balance: run.balance,
  card: run.card,
});

/** 자동 강화가 끝난 뒤 한 줄(시도 수 · 결과 · 쓴 금액)과 멈춘 이유. */
export function enhanceAutoSummary(run: EnhanceAutoRun, target: number) {
  const done = run.tries
    ? L.autoDone({
        n: run.tries,
        up: run.up,
        keep: run.keep,
        down: run.down,
        spent: fmtValue(run.spent),
      })
    : null;
  const why =
    run.stop === 'target'
      ? L.stopTarget({ lv: target })
      : run.stop === 'funds'
        ? L.stopFunds
        : run.stop === 'budget'
          ? L.stopBudget
          : run.stop === 'cup'
            ? L.stopCup
            : run.stop === 'user'
              ? L.stopUser
              : run.stop === 'error'
                ? run.error
                : null;
  return { done, why };
}
