/**
 * T-11-310 감독 커리어. zod가 없는 서브패스(`@offside/contracts/manager-rules`)라 게임 엔진 · 웹 · 서버가 같은 규칙을 쓴다.
 *
 * 은퇴한 내 카드는 감독 커리어를 시작할 수 있다. 시작하면 그 카드는 감독으로 분류돼 선발 · 거래 · 방출 · 잠금에서 빠지고,
 * 끝까지 마치면 감독 카드가 된다(거래 불가). 감독 카드는 팀마다 하나 있는 감독 칸에 넣어 줄 힘을 조금 보정한다.
 * 감독 칸이 비면 지금과 같은 결과다.
 */
import type { FormationId } from './owner-team.js';
import type { SynergyLines } from './team-synergy.js';
import type { DetailPos, PosGroup } from './positions.js';

/** 감독 성향. 이득과 대가가 함께 있다. */
export const MANAGER_STYLES = ['attack', 'balance', 'defense', 'counter'] as const;
export type ManagerStyle = (typeof MANAGER_STYLES)[number];

/** 포메이션 숙련 등급(낮은 것부터). */
export const MASTERY_GRADES = ['C', 'B', 'A', 'S'] as const;
export type MasteryGrade = (typeof MASTERY_GRADES)[number];

/** 감독 특기. 짝지은 시너지가 켜진 팀에서만 효과가 난다. */
export const MANAGER_SPECIALS = ['wing', 'midfield', 'defense', 'counter', 'youth'] as const;
export type ManagerSpecial = (typeof MANAGER_SPECIALS)[number];
export const MANAGER_SPECIALS_MAX = 2;

/** 감독 커리어 엔딩(칭호). 저장값이라 id로 둔다 — 문구는 그릴 때 옮긴다. */
export const MANAGER_ENDINGS = [
  'legend',
  'promoter',
  'youth',
  'oneclub',
  'journeyman',
  'comeback',
  'steady',
] as const;
export type ManagerEnding = (typeof MANAGER_ENDINGS)[number];

/** 감독 커리어 길이(시즌). 시작 때 시드로 정한다. */
export const MANAGER_SEASONS_MIN = 8;
export const MANAGER_SEASONS_MAX = 10;

/** 특기와 짝지은 시너지 id(team-synergy DUOS · TEAM_RULES). */
export const SPECIAL_SYNERGIES: Record<ManagerSpecial, readonly string[]> = {
  wing: ['cross', 'overlap'],
  midfield: ['engine', 'buildup'],
  defense: ['wall', 'cb_pair', 'guardian'],
  counter: ['counter', 'killpass'],
  youth: ['homegrown'],
};

/** 특기가 켜졌을 때 더하는 줄 힘(합 +1). */
export const SPECIAL_EFFECT: Record<ManagerSpecial, Partial<SynergyLines>> = {
  wing: { atk: 1 },
  midfield: { mid: 1 },
  defense: { def: 1 },
  counter: { atk: 1 },
  youth: { mid: 0.5, def: 0.5 },
};

/** 팀 포메이션의 숙련 등급이 공격 · 중원 · 수비 세 줄에 더하는 값. */
export const MASTERY_BONUS: Record<MasteryGrade, number> = { C: 0, B: 0.3, A: 0.6, S: 1 };

/** 성향 효과. 공격 · 수비는 반대쪽을 내주고, 균형은 작게 고르게 준다. */
export const STYLE_EFFECT: Record<ManagerStyle, Partial<SynergyLines>> = {
  attack: { atk: 1, def: -0.6 },
  balance: { mid: 0.4, def: 0.2 },
  defense: { def: 1, atk: -0.6 },
  counter: { atk: 0.7, mid: -0.4 },
};

/** 감독 보정의 줄마다 상한 · 하한. */
export const MANAGER_LINE_MIN = -1.5;
export const MANAGER_LINE_MAX = 3;

/** 감독 카드(감독 칸 · 감독 목록이 그리는 값). */
export type ManagerCardRules = {
  mastery: Record<FormationId, MasteryGrade>;
  style: ManagerStyle;
  specials: readonly ManagerSpecial[];
};

const LINES = ['atk', 'mid', 'def', 'gk'] as const;
const clampLine = (v: number) =>
  Math.round(Math.min(MANAGER_LINE_MAX, Math.max(MANAGER_LINE_MIN, v)) * 100) / 100;

/** 감독 보정 한 갈래(숙련 · 성향 · 특기). 특기는 짝 시너지가 꺼져 있으면 on=false이고 더하지 않는다. */
export type ManagerPart =
  | { src: 'mastery'; grade: MasteryGrade; lines: SynergyLines }
  | { src: 'style'; style: ManagerStyle; lines: SynergyLines }
  | { src: 'special'; special: ManagerSpecial; on: boolean; lines: SynergyLines };

/** T-11-382 감독 보정 내역: 갈래별 값, 상한 전 합(raw), 줄마다 −1.5~+3으로 자른 값(total). */
export type ManagerBreakdown = { parts: ManagerPart[]; raw: SynergyLines; total: SynergyLines };

const zero = (): SynergyLines => ({ atk: 0, mid: 0, def: 0, gk: 0 });
const lines = (v: Partial<SynergyLines>): SynergyLines => ({ ...zero(), ...v });

export function managerBreakdown(
  card: ManagerCardRules | null | undefined,
  formation: FormationId,
  synergies: readonly string[],
): ManagerBreakdown {
  if (!card) return { parts: [], raw: zero(), total: zero() };
  const grade = card.mastery[formation] ?? 'C';
  const m = MASTERY_BONUS[grade];
  const parts: ManagerPart[] = [
    { src: 'mastery', grade, lines: lines({ atk: m, mid: m, def: m }) },
    { src: 'style', style: card.style, lines: lines(STYLE_EFFECT[card.style]) },
    // 한 특기에 짝 시너지가 여럿 켜져도 한 번만 더한다.
    ...card.specials.slice(0, MANAGER_SPECIALS_MAX).map((special) => ({
      src: 'special' as const,
      special,
      on: SPECIAL_SYNERGIES[special].some((id) => synergies.includes(id)),
      lines: lines(SPECIAL_EFFECT[special]),
    })),
  ];
  const raw = zero();
  for (const part of parts) {
    if (part.src === 'special' && !part.on) continue;
    for (const l of LINES) raw[l] += part.lines[l];
  }
  const total = zero();
  for (const l of LINES) total[l] = clampLine(raw[l]);
  return { parts, raw, total };
}

/**
 * 감독이 그 팀 줄 힘에 더하는 값. formation은 팀 포메이션, synergies는 그 경기에서 켜진 시너지 id(시너지를 반영하지
 * 않는 시즌이면 빈 배열이라 특기는 효과가 없다). 감독이 없으면 null을 넘긴다 — 결과는 0이다.
 */
export const managerLines = (
  card: ManagerCardRules | null | undefined,
  formation: FormationId,
  synergies: readonly string[],
): SynergyLines => managerBreakdown(card, formation, synergies).total;

/** 줄 힘 두 개를 더한다(시너지 보정 + 감독 보정). */
export const addLines = (a: SynergyLines, b: SynergyLines): SynergyLines => ({
  atk: a.atk + b.atk,
  mid: a.mid + b.mid,
  def: a.def + b.def,
  gk: a.gk + b.gk,
});

/**
 * 감독 커리어 시작값의 재료. 서버가 은퇴 기록(careers · career_seasons)으로 채운다. 옛 기록이라 모르는 값은 0 · null.
 */
export type ManagerOrigin = {
  pos: PosGroup;
  dpos: DetailPos | null;
  /** 프로 시즌 수(병역 시즌 제외). */
  seasons: number;
  apps: number;
  /** 뛴 프로 구단 수. */
  clubs: number;
  trophies: number;
  caps: number;
  peak: number;
  legendScore: number;
  retireAge: number | null;
  nation: string | null;
};

/** 표시용 감독 등급. */
export const MANAGER_GRADES = ['C', 'B', 'A', 'S'] as const;
export type ManagerGrade = (typeof MANAGER_GRADES)[number];
