// T-11-371 팩 오픈식 결과 공개 연출(웹 RevealFx.svelte · 앱 RevealFx.tsx). 결과는 이미 정해져 저장된 뒤에 보여 주기만 한다.
// 강도(보통 · 좋음 · 대박)는 화면에 이미 공개된 값으로만 정한다. 잠재력이 잠긴 후보의 잠재력을 연출로 흘리지 않는다.
// 연출용 시간 · 순서만 여기 두고, 게임 RNG는 쓰지 않는다(웹 · 앱이 같은 기준을 쓴다).

export type RevealTier = 'normal' | 'good' | 'jackpot';

/** "연출 짧게" 설정 — 이 기기에만 저장한다(세이브가 아니다). */
export const REVEAL_SHORT_KEY = 'ft_reveal_short';

const GRADES = ['D', 'C', 'B', 'A', 'S'] as const;

/** 'C~B' 같은 범위면 높은 쪽 등급. 모르는 글자면 null. */
export function topGrade(label: string): string | null {
  const hi = label.split('~').at(-1)!.trim();
  return (GRADES as readonly string[]).includes(hi) ? hi : null;
}

/** 등급(범위면 높은 쪽)으로 정하는 강도: S 대박, A 좋음. 후보 잠재력 범위 · 시즌 평가 · 은퇴 실제 잠재력이 쓴다. */
export function gradeTier(label: string): RevealTier {
  const g = topGrade(label);
  return g === 'S' ? 'jackpot' : g === 'A' ? 'good' : 'normal';
}

/** 후보 카드 오픈의 강도. 열면 보이는 값(OVR · 보장 · 천장 표시)만 쓴다 — 잠재력 값은 입력으로 받지 않는다. */
export type CandidateRevealInput = {
  ovr: number;
  guaranteed?: boolean | undefined;
  pity?: 'sure' | 'elite' | undefined;
};

/** 천장 후보(S 확정 · 특급)는 대박, 보장 후보나 세 장 중 OVR 단독 최고는 좋음. */
export function candidateTiers(cands: readonly CandidateRevealInput[]): RevealTier[] {
  const best = Math.max(...cands.map((c) => c.ovr));
  const unique = cands.filter((c) => c.ovr === best).length === 1;
  return cands.map((c) =>
    c.pity ? 'jackpot' : c.guaranteed || (unique && c.ovr === best) ? 'good' : 'normal',
  );
}

/** 단계별 시간(ms). back: 뒷면에서 숨 고르기 · hint: 단서가 차오르는 시간 · hold: 결과 직전 멈춤. */
export type RevealTiming = { back: number; hint: number; hold: number };

const TIMING: Record<RevealTier, RevealTiming> = {
  normal: { back: 0, hint: 520, hold: 0 },
  good: { back: 160, hint: 900, hold: 160 },
  jackpot: { back: 320, hint: 1500, hold: 520 },
};
const NONE: RevealTiming = { back: 0, hint: 0, hold: 0 };

/**
 * 연출 시간. off: 감속 모션 · 업무 모드 — 움직임 없이 결과만. short: "연출 짧게" — 결과 단계만.
 * repeat: 같은 화면에서 이미 한 번 연출을 본 뒤(나머지 카드) — 절반으로.
 */
export function revealTiming(
  tier: RevealTier,
  o: { off?: boolean; short?: boolean; repeat?: boolean } = {},
): RevealTiming {
  if (o.off || o.short) return NONE;
  const t = TIMING[tier];
  if (!o.repeat) return t;
  return { back: 0, hint: Math.round(t.hint / 2), hold: Math.round(t.hold / 2) };
}

/** 전체 길이(ms) — 대박도 2.5초 안(기획). */
export const revealTotal = (t: RevealTiming): number => t.back + t.hint + t.hold;

/** 등급 글자가 아래부터 위로 훑고 올라가는 순서. 마지막이 결과 등급이다. 모르는 글자면 그 글자 하나. */
export function gradeSweep(label: string): string[] {
  const g = topGrade(label);
  if (!g) return [label];
  return GRADES.slice(0, GRADES.indexOf(g as (typeof GRADES)[number]) + 1);
}

/** 끝으로 갈수록 느려지는 곡선(BoostFx와 같다). 0~1 → 0~1. */
export const revealEase = (x: number): number => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3;

/** 진행률(0~1)에 맞는 단서 글자 — 곡선을 따라 아래 등급에서 결과 등급으로 올라간다. */
export function sweepAt(steps: readonly string[], x: number): string {
  const i = Math.min(steps.length - 1, Math.floor(revealEase(x) * steps.length));
  return steps[i]!;
}

/** 강도별 진동 길이(ms) — 보통은 진동 없음. */
export const REVEAL_BUZZ: Record<RevealTier, number> = { normal: 0, good: 25, jackpot: 70 };
