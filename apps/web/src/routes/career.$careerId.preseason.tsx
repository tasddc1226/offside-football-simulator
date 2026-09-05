// SCR-005 프리시즌 계획: 시뮬레이션 모드·훈련 계획을 고르고 선택을 search 파라미터로 SCR-011에
// 넘긴다(명령 없음 — RULE-TIME-003 "모드는 START_SEASON 시 고정"이라 여기서는 아무것도 확정하지
// 않는다). 새로고침·뒤로 가기에도 선택이 유지되도록 URL에 싣는다.
import { useEffect, useState } from 'react';
import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import {
  PlayerHeader,
  RadioGroup,
  RadioGroupItem,
  ScreenIntro,
  StatusStrip,
  buttonClassName,
  buttonStyle,
} from '@offside/ui';
import type { SimulationMode } from '@offside/domain';
import { activeRuleset } from '../engine/content.js';
import { careerQueryOptions, useCareer } from '../engine/use-career.js';
import { screenForCareer } from '../shared/career-route.js';
import { archetypeName, currentTeamName } from '../shared/current-team.js';
import { positionHeaderField } from '../shared/labels.js';
import { queryClient } from '../shared/query-client.js';
import { SCREEN_ROUTES } from '../routes.js';
import {
  defaultSimulationMode,
  canPlanNextSeason,
  SIMULATION_MODE_LABEL_KO,
  SIMULATION_MODE_SUMMARY_KO,
  TRAINING_FOCUS_IMPACT_KO,
  TRAINING_FOCUS_LABEL_KO,
  TRAINING_FOCUS_OPTIONS,
  TRAINING_FOCUS_SUMMARY_KO,
  type TrainingFocus,
} from '../shared/start-season.js';
import { u18StatusStripItems } from '../shared/status-strip.js';
import { useUiStore } from '../shared/ui-store.js';
import { platform } from '../platform/index.js';

export const Route = createFileRoute('/career/$careerId/preseason')({
  loader: async ({ params }) => {
    const { state } = await queryClient.ensureQueryData(careerQueryOptions(params.careerId));
    const allowed = canPlanNextSeason(state);
    if (!allowed) {
      const target = screenForCareer(state);
      throw redirect({ to: SCREEN_ROUTES[target.screenId], params: target.params });
    }
  },
  component: PreseasonScreen,
});

const H2_STYLE = { fontSize: 'var(--os-fs-h2)', lineHeight: 'var(--os-lh-h2)' } as const;
const BODY_STYLE = { fontSize: 'var(--os-fs-body)', lineHeight: 'var(--os-lh-body)' } as const;
const CAPTION_STYLE = {
  fontSize: 'var(--os-fs-caption)',
  lineHeight: 'var(--os-lh-caption)',
} as const;

function PreseasonScreen() {
  const { careerId } = Route.useParams();
  const query = useCareer(careerId);
  const profileDefaultMode = useUiStore((uiState) => uiState.defaultSimulationMode);

  useEffect(() => {
    platform.analytics.track('screen_viewed', {
      screenId: 'SCR-005',
      careerPhase: query.data?.state.seasonPhase ?? 'NONE',
    });
    // 마운트 시 1회만(로더가 이미 캐시를 채웠다).
  }, []);

  const state = query.data?.state;
  const [mode, setMode] = useState<SimulationMode | null>(null);
  const [focus, setFocus] = useState<TrainingFocus>('ROLE');

  useEffect(() => {
    if (state === undefined || mode !== null) return;
    setMode(defaultSimulationMode(state, profileDefaultMode));
  }, [state, profileDefaultMode, mode]);

  if (state === undefined || mode === null) return null;
  const profile = state.player.profile;
  const contract = state.contract;
  if (profile === null || contract === null) return null; // 라우트 loader가 보장한다. 방어적 fallback.

  const team = activeRuleset.teams.find((candidate) => candidate.id === contract.teamId);
  const style =
    team === undefined
      ? undefined
      : activeRuleset.tacticalStyles.find((candidate) => candidate.id === team.tacticalStyleId);

  return (
    <div className="os-screen">
      <ScreenIntro
        eyebrow="PRE-SEASON"
        title="프리시즌 계획"
        description="어떤 시즌을 보낼지, 무엇에 집중할지 정해보세요."
      />
      <PlayerHeader
        name={profile.name}
        team={currentTeamName(state, activeRuleset)}
        position={positionHeaderField(profile.primaryPosition, profile.preferredPosition)}
        archetype={{ label: '아키타입', value: archetypeName(activeRuleset, profile.archetypeId) }}
        shirtNumber={{ label: '등번호', value: String(contract.shirtNumber) }}
      />
      <StatusStrip items={u18StatusStripItems(state)} />

      <div className="os-panel flex flex-col gap-os-2">
        <p className="os-eyebrow">시즌을 앞둔 라커룸</p>
        <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
          감독 전술: {style ? `${style.name} · ${style.formation}` : '—'} · 주전 경쟁: 시즌 시작 시
          정해집니다
        </p>
      </div>

      <section className="os-panel flex flex-col gap-os-3">
        <h2 className="font-os font-semibold text-os-text" style={H2_STYLE}>
          시뮬레이션 모드
        </h2>
        <RadioGroup
          className="os-choice-grid"
          aria-label="시뮬레이션 모드"
          value={mode}
          onValueChange={(value) => setMode(value as SimulationMode)}
        >
          {(['FAST', 'CHAPTER'] as const).map((candidate) => (
            <RadioGroupItem
              key={candidate}
              value={candidate}
              className="flex flex-col gap-os-1 p-os-3 text-left"
            >
              <span className="font-os font-semibold text-os-text" style={BODY_STYLE}>
                {SIMULATION_MODE_LABEL_KO[candidate]}
              </span>
              <span className="font-os text-os-text-2" style={CAPTION_STYLE}>
                {SIMULATION_MODE_SUMMARY_KO[candidate]}
              </span>
            </RadioGroupItem>
          ))}
        </RadioGroup>
      </section>

      <section className="os-panel flex flex-col gap-os-3">
        <h2 className="font-os font-semibold text-os-text" style={H2_STYLE}>
          훈련 계획
        </h2>
        <RadioGroup
          className="os-choice-grid"
          aria-label="훈련 계획"
          value={focus}
          onValueChange={(value) => setFocus(value as TrainingFocus)}
        >
          {TRAINING_FOCUS_OPTIONS.map((candidate) => (
            <RadioGroupItem
              key={candidate}
              value={candidate}
              className="flex flex-col gap-os-1 p-os-3 text-left"
            >
              <span className="font-os font-semibold text-os-text" style={BODY_STYLE}>
                {TRAINING_FOCUS_LABEL_KO[candidate]}
              </span>
              <span className="font-os text-os-text-2" style={CAPTION_STYLE}>
                {TRAINING_FOCUS_SUMMARY_KO[candidate]}
              </span>
            </RadioGroupItem>
          ))}
        </RadioGroup>
        <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
          {TRAINING_FOCUS_IMPACT_KO}
        </p>
      </section>

      <div className="os-action-dock">
        <Link
          to="/career/$careerId/season-prep"
          params={{ careerId }}
          search={{ mode, focus }}
          className={buttonClassName('primary')}
          style={buttonStyle}
        >
          다음
        </Link>
      </div>
    </div>
  );
}
