// T-3-005 SCR-020: 성공한 계약/임대 전환을 저장된 Snapshot의 timeline·clubHistory에서 재구성한다.
// mutation 응답의 휘발성 payload에 의존하지 않으므로 새로고침·응답 유실·뒤로가기에 안전하다.
import { computeContractSeasonsRemaining, type CareerState, type Contract, type TimelineEntry } from '@offside/domain';
import { LEAGUE_TIER_LABEL_KO, POSITION_LABELS, SQUAD_ROLE_LABELS } from './labels.js';
import { MARKET_REASON_LABEL_KO, OFFER_KIND_LABEL_KO } from './transfer-view.js';

export type TransferResultKind = 'RENEWAL' | 'TRANSFER' | 'FREE_AGENT' | 'LOAN' | 'RETURN' | 'PERMANENT' | 'STAY';

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
    appliesAt: string;
  } | null;
  /** Response-loss recovery binding; not rendered. */
  contractOfferId: string | null;
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
  // T-4-011: 안전 잔류(ACCEPT_OFFER의 INTEREST safe offer, REJECT_OFFER(null))는 계약·clubHistory를
  // 바꾸지 않고 OFFER_REJECTED(refId 'ALL')만 남긴다. 개별 제안 거절(refId = offerId)은 시장이 아직
  // 열려 있다는 뜻이라 결과로 취급하면 안 되므로 isTransitionEntry에서 refId를 함께 확인한다.
  'OFFER_REJECTED',
]);

function isTransitionEntry(entry: TimelineEntry): boolean {
  return TRANSITION_KINDS.has(entry.kind) && (entry.kind !== 'OFFER_REJECTED' || entry.refId === 'ALL');
}

function transitionEntriesAtRevision(state: CareerState, revision: number): TimelineEntry[] {
  return state.timeline.filter((entry) => entry.revision === revision && isTransitionEntry(entry));
}

/** 결과 deep-link에 rev가 없을 때 최신 계약 전환 revision을 찾는다. */
export function latestTransferRevision(state: CareerState): number | null {
  const latest = [...state.timeline].reverse().find((entry) => isTransitionEntry(entry));
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
  if (offerId !== undefined && view.contractOfferId !== offerId) return null;
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
  if (entries.some((entry) => entry.kind === 'OFFER_REJECTED')) return 'STAY';
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
    case 'STAY':
      return '잔류';
  }
}

function currentAndPreviousTeams(state: CareerState, kind: TransferResultKind): { previousTeam: string; newTeam: string } {
  const current = state.clubHistory.at(-1);
  const previous = state.clubHistory.at(-2);
  if (kind === 'RENEWAL' || kind === 'STAY') {
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

function contractView(state: CareerState, kind: TransferResultKind, entries: readonly TimelineEntry[]): TransferResultView['contract'] {
  const transitionContractId = entries.find((entry) => entry.kind === 'CONTRACT_RENEWED')?.refId;
  const futureRenewal = kind === 'RENEWAL' && state.nextContract?.id === transitionContractId;
  const contract = futureRenewal ? state.nextContract ?? null : state.contract;
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
    competition: futureRenewal ? '다음 시즌 시작 시 확정' : competitionStatus(state, contract),
    appliesAt: futureRenewal ? '이번 시즌 종료 후 적용' : '즉시 적용',
  };
}

function withAndParticle(name: string): string {
  const last = name.codePointAt(name.length - 1);
  if (last === undefined || last < 0xac00 || last > 0xd7a3) return `${name}와`;
  return `${name}${(last - 0xac00) % 28 === 0 ? '와' : '과'}`;
}

/**
 * timeline의 같은 revision에 남은 도메인 transition만 이용해 SCR-020을 재구성한다. `interestedClubCount`는
 * INTEREST 시장 안전 잔류(STAY) 전용 표시값이다 — 도메인이 잔류 시점에 시장에 있던 타 구단 제안 수를
 * timeline에 남기지 않으므로(§ buildStayState), 호출자가 수락 직전 pending에서 직접 세어 넘긴다.
 * 새로고침·딥링크로 재진입해 값이 없으면 구체적 개수 없이도 STAY 카드는 그대로 렌더된다.
 */
export function resolveTransferResultView(
  state: CareerState,
  revision: number,
  interestedClubCount?: number,
): TransferResultView | null {
  // 과거 contract/clubHistory의 계약 조건을 보존한 저장 근거가 없으므로, 최신 transition만 현재
  // contract와 조합한다. 옛 rev를 허용하면 과거 kind와 최신 팀/계약이 섞인 결과가 된다.
  if (latestTransferRevision(state) !== revision) return null;
  const entries = transitionEntriesAtRevision(state, revision);
  const kind = resultKind(state, entries);
  if (kind === null) return null;

  const teams = currentAndPreviousTeams(state, kind);
  const contract = contractView(state, kind, entries);
  const renewalContractId = entries.find((entry) => entry.kind === 'CONTRACT_RENEWED')?.refId;
  const resultContract = kind === 'RENEWAL' && state.nextContract?.id === renewalContractId ? state.nextContract : state.contract;
  const contractOfferId = resultContract?.offerId ?? null;
  // relationshipLog는 이 전환과 revision으로 연결되지 않을 수 있다. 과거 이벤트의 reasonTag를
  // 새 이적 사유처럼 보이지 않게 하고, timeline transition kind에서 확인 가능한 사실만 문장화한다.
  const reasonTag = transitionReason(kind, state, contract?.competition ?? '프리시즌에서 확정', interestedClubCount);
  const baseOvr = state.player.profile?.baseOvr ?? 0;
  const title =
    kind === 'STAY'
      ? `${teams.newTeam}에 잔류합니다`
      : kind === 'RENEWAL'
        ? `${withAndParticle(teams.newTeam)} 계약을 갱신했습니다`
        : `${teams.newTeam}에서 새 출발합니다`;
  const body =
    kind === 'STAY'
      ? `${teams.newTeam}과의 계약을 그대로 유지하며 시즌을 이어갑니다.`
      : kind === 'RETURN'
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
    contractOfferId,
    reasonTag,
    baseOvr: { before: baseOvr, after: baseOvr },
  };
}

function transitionReason(kind: TransferResultKind, state: CareerState, competition: string, interestedClubCount?: number): string {
  if (kind === 'STAY') {
    const contract = state.contract;
    const remainingSeasons =
      contract === null ? 0 : computeContractSeasonsRemaining(contract.lengthSeasons, contract.signedAtRevision, state.timeline);
    const interestPhrase =
      interestedClubCount === undefined
        ? '관심을 보인 구단들의 제안'
        : interestedClubCount > 0
          ? `관심을 보인 구단 ${interestedClubCount}곳의 제안`
          : '타 구단 이적 제안';
    return (
      `${interestPhrase}을 뒤로하고 안전하게 잔류했습니다. 남은 계약 ${remainingSeasons}시즌 · ` +
      `시장 사유: ${MARKET_REASON_LABEL_KO.INTEREST} · 전술 적합도 ${state.context.tacticalFit} · 경쟁 상태: ${competition}. ` +
      '관계·평판 변화는 없습니다.'
    );
  }
  const relationshipReason =
    kind === 'RENEWAL'
      ? '관계 변화 없이 기존 소속을 유지했습니다.'
      : kind === 'RETURN'
        ? '감독 신뢰·주장·라이벌 관계는 원소속 기준으로 재설정되고 팬 관계는 일부만 이월됩니다.'
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
