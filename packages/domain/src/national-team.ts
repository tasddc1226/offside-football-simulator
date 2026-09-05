import { compareCodePoints } from './canonical.js';
import type { Ruleset } from './ruleset.js';
import type {
  CareerState,
  Effect,
  NationalDebutReservation,
  NationalTeamCallUp,
  NationalTeamCallUpRecord,
  NationalTeamState,
} from './types.js';

/** T-4-004 D-51: qualification 판정은 decision/match RNG와 완전히 분리된 pure 계산이다. */
export type NationalTeamQualificationReason =
  | 'BASE_OVR'
  | 'RATING_AND_POPULARITY'
  | 'NOT_ACTIVE'
  | 'NOT_PRO'
  | 'NO_CONTRACT'
  | 'WRONG_STEP'
  | 'NO_PROFILE'
  | 'ALREADY_CALLED_UP'
  | 'INELIGIBLE';

export type NationalTeamQualification = {
  eligible: boolean;
  reason: NationalTeamQualificationReason;
};

function currentSeasonIndex(state: CareerState): number {
  return state.season?.index ?? state.seasonHistory.length + 1;
}

function hasCallUpThisSeason(state: CareerState, seasonIndex: number): boolean {
  return state.nationalTeam.callUps.some((callUp) => callUp.seasonIndex === seasonIndex);
}

function hasPreviousSeasonRatingAtLeast(state: CareerState, minRatingTenths: number): boolean {
  const previous = state.seasonHistory[state.seasonHistory.length - 1];
  if (previous === undefined) return false;
  const stats = previous.result.playerStats;
  return stats.ratedMatches > 0 && stats.ratingSumTenths >= minRatingTenths * stats.ratedMatches;
}

/**
 * T-4-004 §4: 프로·ACTIVE·callUpStep에서만, (tier별 base OVR) OR (직전 시즌 평점+인기)로 자격을
 * 계산한다. 입력을 읽기만 하며 RNG를 소비하거나 상태를 변경하지 않는다.
 */
export function qualifyNationalTeam(
  state: CareerState,
  ruleset: Ruleset,
  step = state.season?.currentStep ?? state.currentStep,
): NationalTeamQualification {
  if (state.status !== 'ACTIVE') return { eligible: false, reason: 'NOT_ACTIVE' };
  if (state.stage !== 'PRO') return { eligible: false, reason: 'NOT_PRO' };
  if (state.contract === null) return { eligible: false, reason: 'NO_CONTRACT' };
  if (step !== ruleset.nationalTeamRules.callUpStep) return { eligible: false, reason: 'WRONG_STEP' };

  const seasonIndex = currentSeasonIndex(state);
  if (hasCallUpThisSeason(state, seasonIndex)) return { eligible: false, reason: 'ALREADY_CALLED_UP' };

  const profile = state.player.profile;
  if (profile === null) return { eligible: false, reason: 'NO_PROFILE' };

  const tierKey = String(state.contract.leagueTier) as 'YOUTH' | '1' | '2' | '3';
  const baseOvrThreshold = ruleset.nationalTeamRules.minOvrByTier[tierKey];
  if (baseOvrThreshold !== undefined && profile.baseOvr >= baseOvrThreshold) {
    return { eligible: true, reason: 'BASE_OVR' };
  }

  const ratingPath = hasPreviousSeasonRatingAtLeast(state, ruleset.nationalTeamRules.minRatingTenths);
  if (ratingPath && state.reputation.popularityCenti >= ruleset.nationalTeamRules.minPopularityCenti) {
    return { eligible: true, reason: 'RATING_AND_POPULARITY' };
  }

  return { eligible: false, reason: 'INELIGIBLE' };
}

export function buildNationalTeamCallUpRecord(
  state: CareerState,
  eventId: string,
  version: number,
  decision: NationalTeamCallUp,
  reason: 'INJURY' | null = null,
  step = state.season?.currentStep ?? state.currentStep,
): NationalTeamCallUpRecord {
  return {
    seasonIndex: currentSeasonIndex(state),
    step,
    eventId,
    version,
    decision,
    reason,
  };
}

export function applyNationalTeamCallUp(
  nationalTeam: NationalTeamState,
  record: NationalTeamCallUpRecord,
): NationalTeamState {
  return {
    ...nationalTeam,
    callUps: [...nationalTeam.callUps, record],
  };
}

function acceptedCallUpCount(nationalTeam: NationalTeamState): number {
  return nationalTeam.callUps.filter((callUp) => callUp.decision !== 'DECLINE').length;
}

/**
 * 가상 상대 선택은 룰셋 opponents를 code-point 정렬한 뒤 수락 누계 index를 순환한다. 고정 정렬이므로
 * 결정 RNG·경기 RNG·runtime별 locale에 의존하지 않는다.
 */
export function chooseNationalOpponent(
  ruleset: Ruleset,
  acceptedCount: number,
): NationalDebutReservation {
  const opponents = [...ruleset.nationalTeamRules.opponents].sort(compareCodePoints);
  if (opponents.length === 0) throw new RangeError('nationalTeamRules.opponents가 비어 있다.');
  const index = Math.max(0, acceptedCount) % opponents.length;
  return {
    opponentId: `NATIONAL_OPPONENT_${String(index + 1).padStart(3, '0')}`,
    opponentName: opponents[index]!,
  };
}

/** 최초 ACCEPT/CONDITIONAL에만 persistent NATIONAL_DEBUT reservation을 만든다. */
export function reserveNationalDebut(
  nationalTeam: NationalTeamState,
  ruleset: Ruleset,
): NationalTeamState {
  if (nationalTeam.debuted || nationalTeam.pendingDebut !== null) return nationalTeam;
  return {
    ...nationalTeam,
    pendingDebut: chooseNationalOpponent(ruleset, acceptedCallUpCount(nationalTeam) - 1),
  };
}

/** T-4-004 §8: 선택 결과가 바꾸는 기존 축은 fitness/fans/agent뿐이다. managerTrust는 포함하지 않는다. */
export function nationalTeamEffects(
  ruleset: Ruleset,
  eventId: string,
  callUp: NationalTeamCallUp,
): Effect[] {
  const effects: Effect[] = [];
  const sourcePrefix = `${eventId}:NATIONAL_TEAM:${callUp}`;
  const fitnessDelta = -ruleset.nationalTeamRules.fitnessCost[callUp];
  if (fitnessDelta !== 0) {
    effects.push({
      kind: 'CURRENT',
      sourceId: `${sourcePrefix}:FITNESS`,
      target: 'fitness',
      delta: fitnessDelta,
      clamp: { min: 0, max: 100 },
      appliesAt: { kind: 'IMMEDIATE' },
      expiresAt: null,
      stackingRule: 'SUM',
      reasonTag: `NATIONAL_TEAM_${callUp}`,
    });
  }
  for (const target of ['fans', 'agent'] as const) {
    const delta = ruleset.nationalTeamRules.relationDelta[callUp][target];
    if (delta === 0) continue;
    effects.push({
      kind: 'RELATION',
      sourceId: `${sourcePrefix}:${target.toUpperCase()}`,
      target,
      delta,
      clamp: { min: 0, max: 100 },
      appliesAt: { kind: 'IMMEDIATE' },
      expiresAt: null,
      stackingRule: 'SUM',
      reasonTag: `NATIONAL_TEAM_${callUp}`,
    });
  }
  return effects;
}
