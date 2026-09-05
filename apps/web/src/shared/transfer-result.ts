// T-3-005 SCR-020: 성공한 계약/임대 전환을 저장된 Snapshot의 timeline·clubHistory에서 재구성한다.
// mutation 응답의 휘발성 payload에 의존하지 않으므로 새로고침·응답 유실·뒤로가기에 안전하다.
import type { CareerState, Contract, TimelineEntry } from '@offside/domain';
import { LEAGUE_TIER_LABEL_KO, POSITION_LABELS, SQUAD_ROLE_LABELS } from './labels.js';
import { OFFER_KIND_LABEL_KO } from './transfer-view.js';

export type TransferResultKind = 'RENEWAL' | 'TRANSFER' | 'FREE_AGENT' | 'LOAN' | 'RETURN' | 'PERMANENT';

export type TransferResultView = {
  revision: number;
  kind: TransferResultKind;
  kindLabel: string;
  title: string;
  body: string;
  previousTeam: string;
  newTeam: string;
  contract: {
    kind: Contract['kind'];
    league: string;
    lengthSeasons: number;
    wageMinorPerWeek: number;
    role: string;
    appearanceSharePercent: number;
    position: string;
    tacticalFit: number;
    competition: string;
  } | null;
  reasonTag: string;
  baseOvr: { before: number; after: number };
};

export type TransferResultNextScreen = 'PRESEASON' | 'DASHBOARD';

/** 활성 시즌 중에는 현재 대시보드로, 결산 뒤(season === null)에만 새 프리시즌으로 보낸다. */
export function transferResultNextScreen(state: CareerState): TransferResultNextScreen {
  return state.season === null ? 'PRESEASON' : 'DASHBOARD';
}

const TRANSITION_KINDS = new Set<TimelineEntry['kind']>([
  'CONTRACT_RENEWED',
  'TRANSFERRED',
  'LOANED',
  'LOAN_RETURNED',
  'CONTRACT_SIGNED',
]);

function transitionEntriesAtRevision(state: CareerState, revision: number): TimelineEntry[] {
  return state.timeline.filter((entry) => entry.revision === revision && TRANSITION_KINDS.has(entry.kind));
}

/** 결과 deep-link에 rev가 없을 때 최신 계약 전환 revision을 찾는다. */
export function latestTransferRevision(state: CareerState): number | null {
  const latest = [...state.timeline].reverse().find((entry) => TRANSITION_KINDS.has(entry.kind));
  return latest?.revision ?? null;
}

/** 결과 URL이 가리키는 transition이 현재 저장 snapshot의 revision인지 검증한다. */
export function isCurrentTransferResultRevision(state: CareerState, recordRevision: number, revision: number): boolean {
  return recordRevision === revision && resolveTransferResultView(state, revision) !== null;
}

/**
 * 결정 라우트가 응답 유실 뒤 재진입했을 때만 결과로 복구할 revision을 돌려준다. offerId가 있으면
 * 현재 계약과 연결되는지 확인해 오래된 /contract 링크가 과거 결과로 잘못 점프하지 않게 한다.
 */
export function committedTransferRevision(state: CareerState, currentRevision: number, offerId?: string): number | null {
  const revision = latestTransferRevision(state);
  // 결정 응답이 유실된 직후의 저장 상태만 복구한다. 이후 명령이 한 번이라도 적용됐다면 과거
  // 결과를 stale deep-link에 재투영하지 않고 caller가 screenForCareer로 정상 복구한다.
  if (revision === null || revision !== currentRevision) return null;
  const view = resolveTransferResultView(state, revision);
  if (view === null) return null;
  if (offerId !== undefined && state.contract?.offerId !== offerId) return null;
  return revision;
}

function resultKind(state: CareerState, entries: readonly TimelineEntry[]): TransferResultKind | null {
  const returned = entries.find((entry) => entry.kind === 'LOAN_RETURNED');
  if (returned?.refId === 'RETURN') return 'RETURN';
  if (returned?.refId === 'PERMANENT') return 'PERMANENT';
  if (entries.some((entry) => entry.kind === 'LOANED')) return 'LOAN';
  if (entries.some((entry) => entry.kind === 'CONTRACT_RENEWED')) return 'RENEWAL';
  if (entries.some((entry) => entry.kind === 'TRANSFERRED')) return 'TRANSFER';
  if (entries.some((entry) => entry.kind === 'CONTRACT_SIGNED')) {
    const previous = state.clubHistory.at(-2);
    return previous?.endReason === 'EXPIRED' ? 'FREE_AGENT' : null;
  }
  return null;
}

function kindLabel(kind: TransferResultKind): string {
  switch (kind) {
    case 'RENEWAL':
      return OFFER_KIND_LABEL_KO.RENEWAL;
    case 'TRANSFER':
      return OFFER_KIND_LABEL_KO.TRANSFER;
    case 'FREE_AGENT':
      return OFFER_KIND_LABEL_KO.FREE_AGENT;
    case 'LOAN':
      return OFFER_KIND_LABEL_KO.LOAN;
    case 'RETURN':
      return '원소속 복귀';
    case 'PERMANENT':
      return '임대 구단 완전 이적';
  }
}

function currentAndPreviousTeams(state: CareerState, kind: TransferResultKind): { previousTeam: string; newTeam: string } {
  const current = state.clubHistory.at(-1);
  const previous = state.clubHistory.at(-2);
  if (kind === 'RENEWAL') {
    const team = current?.teamName ?? state.contract?.teamName ?? '현재 팀';
    return { previousTeam: team, newTeam: team };
  }
  return {
    previousTeam: previous?.teamName ?? '이전 소속 없음',
    newTeam: current?.teamName ?? state.contract?.teamName ?? '새 소속 없음',
  };
}

function competitionStatus(state: CareerState, contract: Contract | null): string {
  const season = state.season;
  if (contract === null || season === null || season.teamId !== contract.teamId) return '프리시즌에서 확정';
  const player = season.selection.candidates.find((candidate) => candidate.id === 'PLAYER');
  if (player === undefined) return '프리시즌에서 확정';
  const appearance = player.appearance === 'START' ? '주전' : player.appearance === 'SUB' ? '교체' : '결장';
  return `현재 선발 경쟁 ${player.rank}위 · ${appearance}`;
}

function contractView(state: CareerState): TransferResultView['contract'] {
  const contract = state.contract;
  if (contract === null) return null;
  return {
    kind: contract.kind,
    league: LEAGUE_TIER_LABEL_KO[contract.leagueTier],
    lengthSeasons: contract.lengthSeasons,
    wageMinorPerWeek: contract.wageMinorPerWeek,
    role: SQUAD_ROLE_LABELS[contract.rolePromise],
    appearanceSharePercent: Math.round(contract.appearancePromise.minutesShareBp / 100),
    position: POSITION_LABELS[contract.positionPlan],
    tacticalFit: state.context.tacticalFit,
    competition: competitionStatus(state, contract),
  };
}

/** timeline의 같은 revision에 남은 도메인 transition만 이용해 SCR-020을 재구성한다. */
export function resolveTransferResultView(state: CareerState, revision: number): TransferResultView | null {
  // 과거 contract/clubHistory의 계약 조건을 보존한 저장 근거가 없으므로, 최신 transition만 현재
  // contract와 조합한다. 옛 rev를 허용하면 과거 kind와 최신 팀/계약이 섞인 결과가 된다.
  if (latestTransferRevision(state) !== revision) return null;
  const entries = transitionEntriesAtRevision(state, revision);
  const kind = resultKind(state, entries);
  if (kind === null) return null;

  const teams = currentAndPreviousTeams(state, kind);
  const contract = contractView(state);
  // relationshipLog는 이 전환과 revision으로 연결되지 않을 수 있다. 과거 이벤트의 reasonTag를
  // 새 이적 사유처럼 보이지 않게 하고, timeline transition kind에서 확인 가능한 사실만 문장화한다.
  const reasonTag = transitionReason(kind, state, contract?.competition ?? '프리시즌에서 확정');
  const baseOvr = state.player.profile?.baseOvr ?? 0;
  const title = kind === 'RENEWAL' ? `${teams.newTeam}과 계약을 갱신했습니다` : `${teams.newTeam}에서 새 출발합니다`;
  const body =
    kind === 'RETURN'
      ? `${teams.previousTeam} 생활을 마치고 원소속으로 돌아갑니다.`
      : kind === 'LOAN'
        ? `${teams.newTeam} 임대 계약이 확정되었습니다.`
        : `${kindLabel(kind)} 결과가 저장되었습니다.`;

  return {
    revision,
    kind,
    kindLabel: kindLabel(kind),
    title,
    body,
    previousTeam: teams.previousTeam,
    newTeam: teams.newTeam,
    contract,
    reasonTag,
    baseOvr: { before: baseOvr, after: baseOvr },
  };
}

function transitionReason(kind: TransferResultKind, state: CareerState, competition: string): string {
  const relationshipReason =
    kind === 'RENEWAL'
      ? '관계 변화 없이 기존 소속을 유지했습니다.'
      : kind === 'RETURN'
        ? '저장된 원소속 계약과 관계 상태를 복원했습니다.'
        : '새 소속 전환에 따른 현재 관계 상태를 저장했습니다.';
  const evidence = `전술 적합도 ${state.context.tacticalFit} · 경쟁 상태: ${competition}`;
  const suffix = `${evidence}. ${relationshipReason}`;
  switch (kind) {
    case 'RENEWAL':
      return `현재 구단과의 재계약 조건을 확정했습니다. ${suffix}`;
    case 'TRANSFER':
      return `새 구단 제안과 계약 조건을 확정했습니다. ${suffix}`;
    case 'FREE_AGENT':
      return `계약 만료 뒤 새 구단 제안과 계약 조건을 확정했습니다. ${suffix}`;
    case 'LOAN':
      return `임대 제안과 출전 계획을 확정했습니다. ${suffix}`;
    case 'RETURN':
      return `임대 계약 조건에 따라 원소속 복귀를 확정했습니다. ${suffix}`;
    case 'PERMANENT':
      return `매입 옵션과 출전 기준을 충족해 임대 구단 완전 이적을 확정했습니다. ${suffix}`;
  }
}
