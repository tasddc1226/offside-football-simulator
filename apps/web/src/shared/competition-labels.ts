import type { Ruleset } from '@offside/domain';
import { CUP_ROUND_LABEL_KO } from './labels.js';

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
  return round === null ? '—' : (CUP_PROGRESS_LABELS[round] ?? '—');
}

export function opponentDisplayName(opponent: { id: string; name: string }, ruleset: Ruleset): string {
  if (ruleset.teams.some((team) => team.id === opponent.id)) return opponent.name;
  for (const cup of ruleset.cups) {
    for (const [round, label] of Object.entries(CUP_ROUND_LABEL_KO)) {
      if (opponent.id === `${cup.id}-${round}`) return `${cup.name} ${label} 상대`;
    }
  }
  return opponent.name;
}
