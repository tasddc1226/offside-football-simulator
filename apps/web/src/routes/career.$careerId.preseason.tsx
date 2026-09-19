// SCR-005 프리시즌 계획: 훈련 계획을 고르고 선택을 search 파라미터로 SCR-011에 넘긴다(명령 없음).
// 새로고침·뒤로 가기에도 선택이 유지되도록 URL에 싣는다. 시뮬레이션 모드는 더 이상 고르지 않는다
// (사용자 결정 2026-09-13, D-77) — 모든 시즌은 항상 FIXED_SIMULATION_MODE(FAST)로 시작한다.
import { useEffect, useState } from 'react';
import { computeContractSeasonsRemaining, RETIREMENT_POLICY, type ClubMeetingRequest } from '@offside/domain';
import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import {
  RadioGroup,
  RadioGroupItem,
  ScreenIntro,
  buttonClassName,
  buttonStyle,
} from '@offside/ui';
import { rulesetForCareer } from '../engine/content.js';
import { careerQueryOptions, useCareer, useCareerMutation } from '../engine/use-career.js';
import { useServiceSeason } from '../engine/service-season.js';
import { screenForCareer } from '../shared/career-route.js';
import { ATTRIBUTE_LABELS, SQUAD_ROLE_LABELS } from '../shared/labels.js';
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
import { GrowthSnapshot } from '../shared/simulator-hub.js';
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
  const [meetingRequest, setMeetingRequest] = useState<ClubMeetingRequest>('PLAYING_TIME');
  const meetingMutation = useCareerMutation('requestClubMeeting');
  const [meetingError, setMeetingError] = useState<string | null>(null);

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

  // 이슈 163·166: 직전 결산에 이미 저장된 값만 읽는 표시 전용 안내(데이터 없으면 숨김).
  const capNotice = potentialCapNotice(state);
  const pressureNotice = retirementPressureNotice(state, ruleset.retirementRules ?? RETIREMENT_POLICY);
  const pressureEvidence = pressureNotice === null ? null : retirementEvidenceText(pressureNotice);
  const upcomingSeasonIndex = state.seasonHistory.length + 1;
  const meeting = state.clubMeeting?.seasonIndex === upcomingSeasonIndex ? state.clubMeeting : null;
  const meetingEnabled = ruleset.clubMeetingRules !== undefined;
  const remaining = computeContractSeasonsRemaining(contract.lengthSeasons, contract.signedAtRevision, state.timeline);
  const playingTimeImpossible = contract.rolePromise === 'STARTER';
  const loanImpossible = remaining < 2;
  const requestLabels: Record<ClubMeetingRequest, string> = { PLAYING_TIME: '출전 기회 요청', LOAN: '임대 요청', TRANSFER: '이적 요청' };
  async function submitMeeting() {
    setMeetingError(null);
    try {
      const result = await meetingMutation.mutateAsync({ careerId, request: meetingRequest });
      if (!result.ok) {
        if (result.error.code === 'COMMAND_ALREADY_RESOLVED') await query.refetch();
        setMeetingError(result.error.code === 'COMMAND_ALREADY_RESOLVED' ? '다른 화면에서 이미 이번 시즌 면담을 마쳤습니다.' : result.error.message);
      }
    } catch {
      setMeetingError('면담 요청을 저장하지 못했습니다. 다시 시도해 주세요.');
    }
  }

  return (
    <div className="os-screen sim-training">
      <ScreenIntro
        eyebrow="PRE-SEASON"
        title="프리시즌 계획"
        description="어떤 시즌을 보낼지, 무엇에 집중할지 정해보세요."
      />
      <GrowthSnapshot state={state} />

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

      {meetingEnabled ? (
        <details className="sim-disclosure" aria-label="구단 면담"><summary>구단과 시즌 계획 상담</summary><div className="flex flex-col gap-os-3">
          <div><h2 className="font-os font-semibold text-os-text" style={H2_STYLE}>구단 면담</h2><p className="font-os text-os-text-2" style={CAPTION_STYLE}>선택 사항 · 시즌마다 한 번 구단에 계획을 요청할 수 있습니다.</p></div>
          {meeting === null ? <>
            <RadioGroup className="os-choice-grid" aria-label="구단 면담 요청" value={meetingRequest} onValueChange={(value) => setMeetingRequest(value as ClubMeetingRequest)}>
              {(['PLAYING_TIME','LOAN','TRANSFER'] as const).map((request) => {
                const disabled = (request === 'PLAYING_TIME' && playingTimeImpossible) || (request === 'LOAN' && loanImpossible);
                return <RadioGroupItem key={request} value={request} disabled={disabled || meetingMutation.isPending} className="flex flex-col gap-os-1 p-os-3 text-left"><span>{requestLabels[request]}</span>{disabled ? <span className="os-muted">{request === 'PLAYING_TIME' ? '이미 주전 역할입니다.' : '다음 이적시장 전 계약이 만료됩니다.'}</span> : null}</RadioGroupItem>;
              })}
            </RadioGroup>
            {meetingError ? <p role="alert" className="text-os-danger">{meetingError}</p> : null}
            <button type="button" className={buttonClassName('secondary')} style={buttonStyle} disabled={meetingMutation.isPending || (meetingRequest === 'PLAYING_TIME' && playingTimeImpossible) || (meetingRequest === 'LOAN' && loanImpossible)} onClick={() => void submitMeeting()}>{meetingMutation.isPending ? '면담 중…' : '면담 요청하기'}</button>
          </> : <div className="rounded-os-m bg-os-surface-2 p-os-3"><p className="font-semibold">{requestLabels[meeting.request]} · {meeting.response === 'ACCEPTED' ? '구단 수락' : '구단 거절'}</p><p className="os-muted">즉시 변화: 감독 신뢰 {meeting.immediateEffect.managerTrustDelta >= 0 ? '+' : ''}{meeting.immediateEffect.managerTrustDelta} · 사기 {meeting.immediateEffect.moraleDelta >= 0 ? '+' : ''}{meeting.immediateEffect.moraleDelta}</p><p>시즌 출전 확인 기준: {meeting.goal.targetMinutesShareBp / 100}% · {SQUAD_ROLE_LABELS[meeting.plannedRole]}</p><p className="os-muted">실제 역할과 출전은 프리시즌 경쟁 후 조정될 수 있습니다.</p></div>}
        </div></details>
      ) : null}

      <div className="os-action-dock">
        <Link
          to="/career/$careerId/season-prep"
          params={{ careerId }}
          search={{ focus }}
          className={buttonClassName('primary')}
          style={buttonStyle}
          aria-disabled={meetingMutation.isPending}
          onClick={(event) => { if (meetingMutation.isPending) event.preventDefault(); }}
        >
          다음
        </Link>
      </div>
    </div>
  );
}
