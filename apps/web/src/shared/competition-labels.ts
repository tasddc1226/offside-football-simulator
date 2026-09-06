import type { Ruleset } from '@offside/domain';
import { CUP_ROUND_LABEL_KO } from './labels.js';
import { resolveTeamName, type TeamNameOverrides } from './team-names.js';

const CUP_PROGRESS_LABELS: Readonly<Record<string, string>> = {
  ...CUP_ROUND_LABEL_KO,
  WON: '우승',
  OUT_R1: '1라운드 탈락',
  OUT_R2: '2라운드 탈락',
  OUT_SEMI: '준결승 탈락',
  OUT_FINAL: '준우승',
};

/** 저장된 경기 코드·해시는 그대로 두고 화면에서만 번역한다. */
export function cupProgressLabel(round: string | null): string {
  return round !== null && Object.hasOwn(CUP_PROGRESS_LABELS, round) ? CUP_PROGRESS_LABELS[round]! : '—';
}

/** `overrides`(UX-001)는 실제 구단(이름 없는 상대·컵 라운드 상대가 아닌)일 때만 적용한다. */
export function opponentDisplayName(
  opponent: { id: string; name: string },
  ruleset: Ruleset,
  overrides: TeamNameOverrides = {},
): string {
  const named = resolveTeamName(ruleset, opponent.id, overrides);
  if (named !== undefined) return named;
  for (const cup of ruleset.cups) {
    for (const [round, label] of Object.entries(CUP_ROUND_LABEL_KO)) {
      if (opponent.id === `${cup.id}-${round}`) return `${cup.name} ${label} 상대`;
    }
  }
  return opponent.name;
}
