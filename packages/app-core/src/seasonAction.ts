// T-11-036 게임 화면 아래 고정 진행 바(웹 Game.svelte · 앱 screens/game/Game.tsx 공용). 이벤트·시즌 결산이 대기 중이면
// 그걸 여는 버튼을, 아니면 구간 진행 버튼과 그 위 한 줄 준비 요약(훈련·자기 투자·컨디션)을 보인다 — 시즌 탭을 맨 아래까지
// 내리지 않고도 무엇으로 다음 구간을 치르는지 보고 넘기게 한다(T-11-025는 버튼을 탭 맨 아래로 내렸다가 매번 내려야 해 불편했다).
import { LAST_PHASE } from '@offside/game/data';
import {
  blockMatches,
  investDef,
  investName,
  leagueOf,
  TRAININGS,
  trainingLabel,
} from '@offside/game/engine';
import type { GameState } from '@offside/game/types';
import { gameText as L } from './i18n/ko/game';

export type SeasonAction =
  { kind: 'pending'; label: string } | { kind: 'advance'; label: string; prep: string };

export function seasonAction(s: GameState): SeasonAction {
  if (s.pending) {
    return {
      kind: 'pending',
      label: s.pending.type === 'event' ? L.actEvent : L.actSeasonEnd,
    };
  }
  const phase = Math.min(s.phase, LAST_PHASE);
  const left = leagueOf(s.leagueId).matches - s.season.played;
  const label =
    phase === 0
      ? L.actPreseason
      : L.actPlay({ n: phase >= LAST_PHASE ? left : Math.min(blockMatches(s), left) });
  const t = TRAININGS.find((x) => x.id === s.training);
  const inv = investDef(s);
  const prep = L.prep({
    train: t ? trainingLabel(s, t) : '-',
    invest: inv.id === 'none' ? L.investNone : investName(s, inv),
    cond: Math.round(s.cond),
  });
  return { kind: 'advance', label, prep };
}
