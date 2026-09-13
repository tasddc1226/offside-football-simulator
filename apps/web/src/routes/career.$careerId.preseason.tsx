// SCR-005 프리시즌 계획: 훈련 계획을 고르고 선택을 search 파라미터로 SCR-011에 넘긴다(명령 없음).
// 새로고침·뒤로 가기에도 선택이 유지되도록 URL에 싣는다. 시뮬레이션 모드는 더 이상 고르지 않는다
// (사용자 결정 2026-09-13, D-77) — 모든 시즌은 항상 FIXED_SIMULATION_MODE(FAST)로 시작한다.
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
import { rulesetForCareer } from '../engine/content.js';
import { careerQueryOptions, useCareer } from '../engine/use-career.js';
import { useServiceSeason } from '../engine/service-season.js';
import { screenForCareer } from '../shared/career-route.js';
import { archetypeName, currentTeamName } from '../shared/current-team.js';
import { ATTRIBUTE_LABELS, positionHeaderField } from '../shared/labels.js';
import {
  GuidanceCard,
  potentialCapNotice,
  retirementEvidenceText,
  retirementPressureNotice,
} from '../shared/play-guidance.js';
import { queryClient } from '../shared/query-client.js';
import { careerStartYear, extractCalendarStartYear, seasonYearLabel } from '../shared/season-year.js';
import { SCREEN_ROUTES } from '../routes.js';
import {
  canPlanNextSeason,
  TRAINING_FOCUS_IMPACT_KO,
  TRAINING_FOCUS_LABEL_KO,
  TRAINING_FOCUS_OPTIONS,
  TRAINING_FOCUS_SUMMARY_KO,
  type TrainingFocus,
} from '../shared/start-season.js';
import { u18StatusStripItems } from '../shared/status-strip.js';
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
  const serviceSeasonQuery = useServiceSeason();

  useEffect(() => {
    platform.analytics.track('screen_viewed', {
      screenId: 'SCR-005',
      careerPhase: query.data?.state.seasonPhase ?? 'NONE',
    });
    // 마운트 시 1회만(로더가 이미 캐시를 채웠다).
  }, []);

  const state = query.data?.state;
  const [focus, setFocus] = useState<TrainingFocus>('ROLE');

  if (state === undefined) return null;
  const profile = state.player.profile;
  const contract = state.contract;
  if (profile === null || contract === null) return null; // 라우트 loader가 보장한다. 방어적 fallback.
  const ruleset = rulesetForCareer(state);
  // 사용자 결정(2026-09-13): 1시즌 = 1년, 커리어 시작 연도부터 "2026 시즌"으로 표기(season-year.ts).
  const startYear = careerStartYear({
    seasonServiceSeasonId: state.season?.serviceSeasonId ?? null,
    currentServiceSeason: serviceSeasonQuery.data,
    calendarStartYear: extractCalendarStartYear(ruleset.leagueCalendar),
  });

  const team = ruleset.teams.find((candidate) => candidate.id === contract.teamId);
  const style =
    team === undefined
      ? undefined
      : ruleset.tacticalStyles.find((candidate) => candidate.id === team.tacticalStyleId);
  // 이슈 163·166: 직전 결산에 이미 저장된 값만 읽는 표시 전용 안내(데이터 없으면 숨김).
  const capNotice = potentialCapNotice(state);
  const pressureNotice = retirementPressureNotice(state);
  const pressureEvidence = pressureNotice === null ? null : retirementEvidenceText(pressureNotice);

  return (
    <div className="os-screen">
      <ScreenIntro
        eyebrow="PRE-SEASON"
        title="프리시즌 계획"
        description="어떤 시즌을 보낼지, 무엇에 집중할지 정해보세요."
      />
      <PlayerHeader
        name={profile.name}
        team={currentTeamName(state, ruleset)}
        position={positionHeaderField(profile.primaryPosition, profile.preferredPosition)}
        archetype={{ label: '아키타입', value: archetypeName(ruleset, profile.archetypeId) }}
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

      {pressureNotice !== null ? (
        <GuidanceCard
          label={`은퇴 압력 예고 · ${pressureNotice.total} / 100`}
          detail={
            pressureEvidence === null
              ? '직전 결산에 연령 하락 기록은 없습니다. 출전 기회·계약·시장 수요가 압력에 함께 반영됩니다.'
              : `직전 결산 노쇠 근거: ${pressureEvidence}`
          }
          action={
            <Link
              to="/career/$careerId/retirement"
              params={{ careerId }}
              className={buttonClassName('secondary')}
              style={buttonStyle}
            >
              은퇴 결정 화면 보기
            </Link>
          }
        >
          다음 시즌도 비슷한 하락이 예상됩니다 — 은퇴 결정 화면에서 선택을 확인하세요.
        </GuidanceCard>
      ) : null}

      <section className="os-panel flex flex-col gap-os-3">
        <h2 className="font-os font-semibold text-os-text" style={H2_STYLE}>
          훈련 계획
        </h2>
        {capNotice !== null ? (
          <GuidanceCard
            label="잠재력 상한 안내"
            className="bg-os-surface-2"
            detail={`${seasonYearLabel(startYear, capNotice.seasonNumber)} 결산 기준 · 정찰 범위 밖 수치는 보여주지 않습니다.`}
          >
            지난 시즌 {capNotice.attributeKeys.map((key) => ATTRIBUTE_LABELS[key]).join('·')}
            {capNotice.attributeKeys.length === 1 ? '은(는)' : '은'} 잠재력 상한에 막혀 성장이 멈췄어요 — 다른
            능력·역할 집중을 고려하세요.
          </GuidanceCard>
        ) : null}
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
          search={{ focus }}
          className={buttonClassName('primary')}
          style={buttonStyle}
        >
          다음
        </Link>
      </div>
    </div>
  );
}
