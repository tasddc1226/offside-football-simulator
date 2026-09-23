import { DEVELOPMENT_DEFAULT, needsDevelopment, type DevelopmentPlan } from './development.js';
import {
  retirementContinuationOptions,
  retirementDecisionRequired,
} from './legacy/career-retirement.js';
import type { Ruleset } from './ruleset.js';
import type { Command } from './simulate.js';
import {
  ATTRIBUTE_KEYS,
  type AttributeKey,
  type DomainSnapshot,
  type SeasonSummary,
} from './types.js';
import type { AnnualStoryThread } from './annual-stories.js';

/** Persisted by the authoritative server, not an instruction to skip decisions. */
export type AnnualPolicy = { training: DevelopmentPlan; routineChoice: 'CAUTIOUS' | 'BALANCED' };
export const DEFAULT_ANNUAL_POLICY: AnnualPolicy = {
  training: DEVELOPMENT_DEFAULT,
  routineChoice: 'CAUTIOUS',
};
export type AnnualCheckpoint = {
  version: 'ANNUAL_V1';
  careerId: string;
  rulesetVersion: string;
  contentPackVersion: string;
  serviceSeasonId: string;
  startRevision: number;
  startAge: number;
  startHistoryCount: number;
  targetSeasonIndex: number;
  startAttributes: Record<AttributeKey, number>;
  startBaseOvr: number;
  /** Existing partial years finish their remaining portion; never silently run a second year. */
  startedMidSeason: boolean;
  policy: AnnualPolicy;
};
export type AnnualChoice = {
  id: string;
  label: string;
  command: Command;
  risk?: 'LOW' | 'MEDIUM' | 'HIGH';
};
export type AnnualContentContext = {
  advance: Extract<Command, { type: 'ADVANCE' }>['payload'];
  pending?: { title: string; important: boolean; choices: AnnualChoice[] };
};
export type AnnualDecision = {
  key: string;
  revision: number;
  kind: string;
  title: string;
  choices: AnnualChoice[];
};
export type AnnualReport = {
  targetSeasonIndex: number;
  startAge: number;
  endAge: number;
  startRevision: number;
  endRevision: number;
  startedMidSeason: boolean;
  retired: boolean;
  minutes: number;
  baseOvr: { before: number; after: number; delta: number };
  attributes: Array<{
    key: AttributeKey;
    before: number;
    after: number;
    delta: number;
    settlementDelta: number;
    duringYearDelta: number;
  }>;
  season: SeasonSummary | null;
  stories: AnnualStoryThread[];
  events: Array<{
    eventId: string;
    choiceId: string;
    outcomeId: string;
    revision: number;
    step: number;
  }>;
};
export type AnnualAction =
  | { status: 'COMMAND'; command: Command }
  | { status: 'WAITING_DECISION'; decision: AnnualDecision }
  | { status: 'COMPLETED'; report: AnnualReport }
  | {
      status: 'ERROR';
      code: 'ANNUAL_UNAVAILABLE' | 'ANNUAL_STATE_MISMATCH' | 'ANNUAL_CONTENT_MISSING';
    };

export function startAnnualRun(
  snapshot: DomainSnapshot,
  ruleset: Ruleset,
  options: { serviceSeasonId: string; policy?: AnnualPolicy },
): AnnualCheckpoint {
  const state = snapshot.state;
  if (
    ruleset.annualRules?.version !== 'ANNUAL_V1' ||
    state.status !== 'ACTIVE' ||
    state.player.profile === null
  )
    throw new Error('ANNUAL_UNAVAILABLE');
  return {
    version: 'ANNUAL_V1',
    careerId: state.careerId,
    rulesetVersion: state.rulesetVersion,
    contentPackVersion: state.contentPackVersion,
    serviceSeasonId: options.serviceSeasonId,
    startRevision: snapshot.revision,
    startAge: state.age,
    startHistoryCount: state.seasonHistory.length,
    targetSeasonIndex: state.season?.index ?? state.seasonHistory.length + 1,
    startAttributes: { ...state.attributes },
    startBaseOvr: state.player.profile.baseOvr,
    startedMidSeason: state.season !== null,
    policy: {
      training: { ...(options.policy?.training ?? DEVELOPMENT_DEFAULT) },
      routineChoice: options.policy?.routineChoice ?? 'CAUTIOUS',
    },
  };
}

function report(snapshot: DomainSnapshot, checkpoint: AnnualCheckpoint): AnnualReport {
  const state = snapshot.state;
  const season =
    state.seasonHistory.find((entry) => entry.index === checkpoint.targetSeasonIndex) ?? null;
  const after = state.player.profile?.baseOvr ?? checkpoint.startBaseOvr;
  return {
    targetSeasonIndex: checkpoint.targetSeasonIndex,
    startAge: checkpoint.startAge,
    endAge: state.age,
    startRevision: checkpoint.startRevision,
    endRevision: snapshot.revision,
    startedMidSeason: checkpoint.startedMidSeason,
    retired: state.status === 'RETIRED',
    minutes: season?.result.playerStats.minutes ?? state.season?.playerStats.minutes ?? 0,
    baseOvr: { before: checkpoint.startBaseOvr, after, delta: after - checkpoint.startBaseOvr },
    attributes: ATTRIBUTE_KEYS.map((key) => {
      const delta = state.attributes[key] - checkpoint.startAttributes[key];
      const settlementDelta =
        season?.result.attributeDeltas.find((entry) => entry.key === key)?.delta ?? 0;
      return {
        key,
        before: checkpoint.startAttributes[key],
        after: state.attributes[key],
        delta,
        settlementDelta,
        duringYearDelta: delta - settlementDelta,
      };
    }),
    season,
    stories: (state.annualStories?.threads ?? []).filter(
      (thread) =>
        thread.sourceRevision > checkpoint.startRevision ||
        (thread.resolvedRevision ?? 0) > checkpoint.startRevision,
    ),
    events: state.timeline
      .filter(
        (entry) =>
          entry.kind === 'EVENT_RESOLVED' &&
          entry.revision > checkpoint.startRevision &&
          entry.refId !== null,
      )
      .flatMap((entry) => {
        const [eventId, choiceId, outcomeId] = entry.refId!.split(':');
        return eventId && choiceId && outcomeId
          ? [{ eventId, choiceId, outcomeId, revision: entry.revision, step: entry.step }]
          : [];
      }),
  };
}

/** One bounded pure transition. Caller executes at most its chunk budget and persists each
 * successful command together with this fixed checkpoint. Resuming never creates a new target. */
export function nextAnnualAction(
  snapshot: DomainSnapshot,
  ruleset: Ruleset,
  checkpoint: AnnualCheckpoint,
  content: AnnualContentContext,
): AnnualAction {
  const state = snapshot.state;
  if (ruleset.annualRules?.version !== 'ANNUAL_V1')
    return { status: 'ERROR', code: 'ANNUAL_UNAVAILABLE' };
  if (
    state.careerId !== checkpoint.careerId ||
    state.rulesetVersion !== checkpoint.rulesetVersion ||
    state.contentPackVersion !== checkpoint.contentPackVersion ||
    snapshot.revision < checkpoint.startRevision ||
    state.seasonHistory.length < checkpoint.startHistoryCount ||
    state.seasonHistory.length > checkpoint.targetSeasonIndex ||
    state.age < checkpoint.startAge ||
    state.age > checkpoint.startAge + 1 ||
    (state.season !== null && state.season.index !== checkpoint.targetSeasonIndex)
  )
    return { status: 'ERROR', code: 'ANNUAL_STATE_MISMATCH' };
  const command = (value: Command): AnnualAction => ({ status: 'COMMAND', command: value });
  const wait = (kind: string, title: string, choices: AnnualChoice[]): AnnualAction =>
    choices.length === 0
      ? { status: 'ERROR', code: 'ANNUAL_CONTENT_MISSING' }
      : {
          status: 'WAITING_DECISION',
          decision: {
            key: `${state.careerId}:${checkpoint.targetSeasonIndex}:${snapshot.revision}:${kind}`,
            revision: snapshot.revision,
            kind,
            title,
            choices,
          },
        };
  if (state.status === 'RETIRED')
    return { status: 'COMPLETED', report: report(snapshot, checkpoint) };
  if (state.status !== 'ACTIVE') return { status: 'ERROR', code: 'ANNUAL_UNAVAILABLE' };
  const pending = state.pending;
  // Boundary offers and loan returns belong to the year that produced them. Resolve them
  // before returning its report, but never START_SEASON for the following year.
  if (pending?.kind === 'LOAN_RETURN')
    return wait(
      'LOAN_RETURN',
      '임대 기간이 끝났습니다',
      pending.options.map((decision) => ({
        id: decision,
        label: decision === 'RETURN' ? '원래 구단으로 돌아간다' : '완전 이적한다',
        command: { type: 'LOAN_RETURN', payload: { decision } },
      })),
    );
  if (pending?.kind === 'OFFERS' || pending?.kind === 'CONTRACT') {
    const offers = pending.offers.filter(
      (offer) =>
        offer.negotiationState !== 'WITHDRAWN' &&
        (offer.validUntilRevision === null || offer.validUntilRevision >= snapshot.revision + 1),
    );
    if (offers.length === 0) return command({ type: 'REJECT_OFFER', payload: { offerId: null } });
    const choices: AnnualChoice[] = offers.map((offer) => ({
      id: offer.id,
      label: `${offer.teamName} 제안을 받아들인다`,
      command: { type: 'ACCEPT_OFFER', payload: { offerId: offer.id } },
    }));
    if (pending.market.reason !== 'FIRST_CONTRACT')
      choices.push({
        id: 'DECLINE_ALL',
        label: '제안을 거절한다',
        command: { type: 'REJECT_OFFER', payload: { offerId: null } },
      });
    if (retirementDecisionRequired(state, ruleset.retirementRules)) {
      for (const offer of retirementContinuationOptions(state, ruleset.retirementRules))
        choices.push({
          id: `${offer.choice}:${offer.offerId}`,
          label: `${offer.teamName}에서 마지막 도전`,
          command: { type: 'RETIRE', payload: { choice: offer.choice, offerId: offer.offerId } },
        });
    }
    return wait(
      pending.kind,
      pending.kind === 'CONTRACT' ? '계약에 관한 제안이 왔습니다' : '다음 행선지를 결정해 주세요',
      choices,
    );
  }
  if (state.seasonHistory.length === checkpoint.targetSeasonIndex)
    return { status: 'COMPLETED', report: report(snapshot, checkpoint) };
  if (pending?.kind === 'SETTLEMENT') return command({ type: 'SETTLE_SEASON', payload: {} });
  if (pending?.kind === 'ROLE_PROPOSAL') {
    if (pending.proposal.type === 'KEEP')
      return command({ type: 'RESOLVE_ROLE', payload: { decision: 'ACCEPT' } });
    return wait(
      'ROLE_PROPOSAL',
      '감독이 역할 변경을 제안했습니다',
      (['ACCEPT', 'DECLINE'] as const).map((decision) => ({
        id: decision,
        label: decision === 'ACCEPT' ? '새 역할을 받아들인다' : '현재 역할을 유지한다',
        command: { type: 'RESOLVE_ROLE', payload: { decision } },
      })),
    );
  }
  if (pending !== null) {
    const context = content.pending;
    if (!context || context.choices.length === 0)
      return { status: 'ERROR', code: 'ANNUAL_CONTENT_MISSING' };
    if (context.important || pending.kind === 'INJURY' || pending.kind === 'NATIONAL_TEAM')
      return wait(pending.kind, context.title, context.choices);
    const choice =
      checkpoint.policy.routineChoice === 'CAUTIOUS'
        ? (context.choices.find((entry) => entry.risk === 'LOW') ?? context.choices[0]!)
        : context.choices[Math.floor(context.choices.length / 2)]!;
    return command(choice.command);
  }
  if (state.season === null && retirementDecisionRequired(state, ruleset.retirementRules))
    return wait('RETIREMENT', '선수 생활의 다음 장을 결정해 주세요', [
      {
        id: 'RETIRE',
        label: '선수 생활을 마친다',
        command: { type: 'RETIRE', payload: { choice: 'RETIRE' } },
      },
    ]);
  if (needsDevelopment(state, ruleset)) {
    const injured = state.health.episodes.some(
      (entry) => entry.status === 'ACTIVE' || entry.status === 'REHAB',
    );
    return command({
      type: 'DEVELOP',
      payload: {
        ...checkpoint.policy.training,
        ...(injured || state.state.fitness < 45 ? { load: 'RECOVERY' as const } : {}),
      },
    });
  }
  if (state.season === null && state.contract !== null)
    return command({
      type: 'START_SEASON',
      payload: {
        simulationMode: state.simulationMode,
        serviceSeasonId: checkpoint.serviceSeasonId,
        trainingFocus:
          checkpoint.policy.training.drill === 'CONTROL'
            ? 'TECHNICAL'
            : checkpoint.policy.training.drill === 'ENGINE'
              ? 'PHYSICAL'
              : 'MENTAL',
        legacyLedger: true,
      },
    });
  return command({ type: 'ADVANCE', payload: content.advance });
}
