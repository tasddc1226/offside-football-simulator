import type { EventDecisionContext } from '../../shared/event-screen.js';
import { relationshipReasonLabel, relationTierLabel, relationshipDirectionArrow, SQUAD_ROLE_LABELS } from '../../shared/labels.js';
import type { CareerState, RelationTarget, Ruleset } from '@offside/domain';
import { CharacterMemoryPanel } from '../../shared/character-memory.js';

const RELATIONS: readonly { target: RelationTarget; label: string }[] = [
  { target: 'managerTrust', label: '감독 신뢰' },
  { target: 'captain', label: '주장' },
  { target: 'rival', label: '라이벌' },
  { target: 'fans', label: '팬' },
  { target: 'agent', label: '에이전트' },
];

function isProTeam(ruleset: Ruleset, teamId: string): boolean {
  const team = ruleset.teams.find((candidate) => candidate.id === teamId);
  return team?.leagueTier !== undefined && team.leagueTier !== 'YOUTH';
}

function captaincyLabel(captaincy: CareerState['captaincy']): string {
  if (captaincy === 'CAPTAIN') return '주장';
  if (captaincy === 'VICE') return '부주장';
  return '없음';
}

export function LockerRoomContext({ state, ruleset }: EventDecisionContext) {
  const appointment = ruleset?.relationshipRules?.captainAppointment;
  const completedProSeasons = ruleset === undefined
    ? 0
    : state.seasonHistory.filter((summary) => isProTeam(ruleset, summary.teamId)).length;
  const activeProSeason = ruleset !== undefined && state.season !== null && isProTeam(ruleset, state.season.teamId);
  const proSeasonsAtSettlement = completedProSeasons + (activeProSeason ? 1 : 0);
  const currentRole = state.season?.squadRole ?? null;
  const hasCandidateCaptainInterventionHint = ruleset?.version === '3.4.0' && state.contentPackVersion === '0.13.0';

  return (
    <section className="os-panel flex flex-col gap-os-4" aria-label="라커룸 관계 맥락">
      <div>
        <h2 className="os-section-title">라커룸의 온도</h2>
        <p className="os-muted">관계 단계는 현재 상태입니다. 화살표는 최근 관계 기록의 변화 방향입니다.</p>
      </div>
      <section className="flex flex-col gap-os-3 rounded-os-m bg-os-surface-2 p-os-3" aria-label="주장단 임명 조건">
        <h3 className="font-semibold">주장단 임명 조건과 현재 상태</h3>
        {appointment === undefined ? (
          <p className="os-muted">이 커리어에서는 주장 임명 조건을 확인할 수 없습니다.</p>
        ) : (
          <>
            <p className="os-muted">
              {state.captaincy === 'CAPTAIN'
                ? '현재 주장입니다. 이 커리어의 주장 임명 조건은 아래와 같습니다.'
                : state.captaincy === 'VICE'
                  ? '현재 부주장입니다. 주장 임명은 아래 조건을 시즌 결산 때 확인합니다.'
                  : '주장단 임명은 아래 조건을 시즌 결산 때 확인합니다.'}
            </p>
            <dl className="grid grid-cols-1 gap-os-2 sm:grid-cols-2">
              <div><dt>프로 시즌</dt><dd>완료 {completedProSeasons}시즌 · 기준 {appointment.minSeasons}시즌{activeProSeason ? ` · 이번 시즌 결산 시 ${proSeasonsAtSettlement}시즌` : ''}</dd></div>
              <div><dt>시즌 종료 역할</dt><dd>주전 필요 · 현재 {currentRole === null ? '진행 중 시즌 없음' : SQUAD_ROLE_LABELS[currentRole]}</dd></div>
              <div><dt>주장 관계</dt><dd>현재 {state.relationships.captain} · 기준 {appointment.minCaptain} 이상</dd></div>
              <div><dt>현재 주장단</dt><dd>{captaincyLabel(state.captaincy)} · 주장단으로 마친 시즌 {state.captaincySeasons}</dd></div>
            </dl>
            <p className="os-muted">주장 임명은 시즌 결산 때 프로 경력·시즌 종료 역할·주장과의 관계로 결정됩니다.</p>
            {hasCandidateCaptainInterventionHint ? <p className="os-muted">주장과의 기억·중재 장면은 임명을 보장하지 않습니다. 만 23세 이후 시즌이 진행되면 주장과 팀 문제를 조율할 기회가 생길 수 있고, 약속을 어기거나 감독 신뢰가 낮아지면 중재를 받을 수도 있습니다. 장면은 쿨다운과 다른 사건 후보 경쟁을 거치며, 선택 결과만 관계 기억에 남습니다.</p> : null}
          </>
        )}
      </section>
      <CharacterMemoryPanel state={state} />
      <div className="grid grid-cols-1 gap-os-2 sm:grid-cols-2" aria-label="관계 5축">
        {RELATIONS.map(({ target, label }) => (
          <div key={target} className="rounded-os-m bg-os-surface-2 p-os-3">
            <div className="flex items-center justify-between gap-os-2"><span>{label}</span><span aria-label={`${label} 최근 변화 방향`}>{relationshipDirectionArrow(state.relationshipLog, target)}</span></div>
            <p className="os-muted">현재 단계 {relationTierLabel(state.relationships[target])}</p>
            <p className="mt-os-1 text-os-text-2">기억: {state.memoryTags[target].length > 0 ? state.memoryTags[target].map((tag) => relationshipReasonLabel(tag)).join(' · ') : '기록 없음'}</p>
          </div>
        ))}
      </div>
      <div>
        <h3 className="font-semibold">최근 변화</h3>
        {state.relationshipLog.length > 0 ? (
          <ul className="mt-os-2 flex flex-col gap-os-1 text-os-text-2">
            {state.relationshipLog.slice(-3).reverse().map((entry, index) => <li key={`${entry.sourceId}-${entry.step}-${index}`}>{RELATIONS.find((relation) => relation.target === entry.target)?.label} {entry.delta > 0 ? '상승' : entry.delta < 0 ? '하락' : '변화 없음'} · {relationshipReasonLabel(entry.reasonTag)}</li>)}
          </ul>
        ) : <p className="os-muted mt-os-2">최근 관계 변화 기록이 없습니다.</p>}
      </div>
    </section>
  );
}
