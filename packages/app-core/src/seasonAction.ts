// T-11-030 게임 화면 아래 고정 진행 바(웹 Game.svelte · 앱 screens/game/Game.tsx 공용). 이벤트·시즌 결산이 대기 중이면
// 그걸 여는 버튼을, 아니면 구간 진행 버튼과 그 위 한 줄 준비 요약(훈련·자기 투자·컨디션)을 보인다 — 시즌 탭을 맨 아래까지
// 내리지 않고도 무엇으로 다음 구간을 치르는지 보고 넘기게 한다(T-11-025는 버튼을 탭 맨 아래로 내렸다가 매번 내려야 해 불편했다).
import { LAST_PHASE } from '@offside/game/data';
import { blockMatches, investDef, leagueOf, TRAININGS, trainingLabel } from '@offside/game/engine';
import type { GameState } from '@offside/game/types';

export type SeasonAction =
  { kind: 'pending'; label: string } | { kind: 'advance'; label: string; prep: string };

export function seasonAction(s: GameState): SeasonAction {
  if (s.pending) {
    return {
      kind: 'pending',
      label: s.pending.type === 'event' ? '⚡ 이벤트 확인' : '시즌 결산 보기',
    };
  }
  const phase = Math.min(s.phase, LAST_PHASE);
  const left = leagueOf(s.leagueId).matches - s.season.played;
  const label =
    phase === 0
      ? '프리시즌 훈련 진행'
      : `훈련 후 ${phase >= LAST_PHASE ? left : Math.min(blockMatches(s), left)}경기 진행`;
  const t = TRAININGS.find((x) => x.id === s.training);
  const inv = investDef(s);
  const prep = `훈련 ${t ? trainingLabel(s, t) : '-'} · 투자 ${inv.id === 'none' ? '없음' : inv.label} · 컨디션 ${Math.round(s.cond)}`;
  return { kind: 'advance', label, prep };
}
