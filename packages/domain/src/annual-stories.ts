import { rollInt } from './rng.js';
import type { CareerState, CoachActor, ChapterOutcomeKind } from './types.js';

export type AnnualStoryFamily = 'OPPORTUNITY' | 'ROLE_TENSION' | 'SCOUT_INTEREST';
export type AnnualStoryThread = {
  id: string;
  family: AnnualStoryFamily;
  actor: CoachActor;
  sourceRevision: number;
  sourceSeason: number;
  sourceStep: number;
  sourceMinutes: number;
  stage: 'OPEN' | 'FOLLOW_UP' | 'CLOSED' | 'CANCELLED';
  dueCareerStep: number;
  choiceId: string | null;
  outcome: ChapterOutcomeKind | null;
  resolvedRevision: number | null;
};
export type AnnualStories = {
  version: 'STORIES_V1';
  evaluatedWindows: string[];
  threads: AnnualStoryThread[];
  resumeStep: number | null;
  resumeReason: 'CHAPTER' | 'DEVELOPMENT' | null;
};
const OPEN_IDS: Record<string, AnnualStoryFamily> = {
  'EVT-DEV-140': 'OPPORTUNITY',
  'EVT-MGR-142': 'ROLE_TENSION',
  'EVT-REL-144': 'SCOUT_INTEREST',
};
const FOLLOW_IDS: Record<string, AnnualStoryFamily> = {
  'EVT-DEV-141': 'OPPORTUNITY',
  'EVT-MGR-143': 'ROLE_TENSION',
  'EVT-REL-145': 'SCOUT_INTEREST',
};
export function isAnnualStoryEvent(id: string): boolean {
  return id in OPEN_IDS || id in FOLLOW_IDS;
}

/** Pure, once-per-observed-window lottery; no polling rerolls and no invented NPC facts. */
export function openAnnualStory(
  state: CareerState,
  candidates: readonly { eventId: string; version: number; weight: number }[],
  revision: number,
): CareerState {
  if (
    state.rulesetVersion !== '3.5.0' ||
    state.pending !== null ||
    state.season === null ||
    state.season.manager === null ||
    state.currentStep < 2 ||
    state.currentStep > 10
  )
    return state;
  // Let forced medical/call-up decisions finish their original same-step resume first.
  // A second interruption here obscures recovery and can duplicate condition application.
  const latest = state.timeline.at(-1);
  if (
    latest?.step === state.currentStep &&
    ['REHAB_CHOSEN', 'NATIONAL_TEAM_CALLED', 'NATIONAL_TEAM_DECLINED'].includes(latest.kind)
  )
    return state;
  const current: AnnualStories = state.annualStories ?? {
    version: 'STORIES_V1',
    evaluatedWindows: [],
    threads: [],
    resumeStep: null,
    resumeReason: null,
  };
  const window = `${state.season.index}:${state.currentStep}`;
  if (current.evaluatedWindows.includes(window)) return state;
  const actor: CoachActor = {
    id: state.season.manager.id,
    name: state.season.manager.name,
    teamId: state.season.teamId,
  };
  const threads = current.threads.map((thread): AnnualStoryThread =>
    (thread.stage === 'OPEN' || thread.stage === 'FOLLOW_UP') &&
    (thread.actor.id !== actor.id || thread.actor.teamId !== actor.teamId)
      ? { ...thread, stage: 'CANCELLED', resolvedRevision: revision }
      : thread,
  );
  const active = threads.find((thread) => thread.stage === 'FOLLOW_UP');
  const careerStep = (state.season.index - 1) * 12 + state.currentStep;
  const pool = candidates.filter((candidate) => {
    if (active)
      return FOLLOW_IDS[candidate.eventId] === active.family && careerStep >= active.dueCareerStep;
    return (
      candidate.eventId in OPEN_IDS &&
      !threads.some((thread) => thread.sourceSeason === state.season!.index) &&
      !threads.some(
        (thread) =>
          thread.family === OPEN_IDS[candidate.eventId] &&
          state.season!.index - thread.sourceSeason < 2,
      )
    );
  });
  const next = {
    ...current,
    evaluatedWindows: [...current.evaluatedWindows, window].slice(-48),
    threads,
  };
  if (pool.length === 0) return { ...state, annualStories: next };
  const chance = rollInt(state.rngState, 10000);
  // Follow-ups already earned by a saved choice are not lost to unrelated event history.
  if (!active && chance.value >= 6500)
    return { ...state, rngState: chance.state, annualStories: next };
  const lottery = rollInt(
    chance.state,
    pool.reduce((sum, event) => sum + event.weight, 0),
  );
  let cursor = lottery.value;
  let selected = pool[pool.length - 1]!;
  for (const entry of pool) {
    cursor -= entry.weight;
    if (cursor < 0) {
      selected = entry;
      break;
    }
  }
  if (!active)
    next.threads = [
      ...threads,
      {
        id: `${selected.eventId}:${revision}`,
        family: OPEN_IDS[selected.eventId]!,
        actor,
        sourceRevision: revision,
        sourceSeason: state.season.index,
        sourceStep: state.currentStep,
        sourceMinutes: state.season.playerStats.minutes,
        stage: 'OPEN' as const,
        dueCareerStep: careerStep + 2,
        choiceId: null,
        outcome: null,
        resolvedRevision: null,
      },
    ].slice(-24);
  const previous = state.timeline.at(-1);
  if (
    previous?.step === state.currentStep &&
    ['CHAPTER_RESOLVED', 'DEVELOPMENT_COMPLETED'].includes(previous.kind)
  ) {
    next.resumeStep = state.currentStep;
    next.resumeReason = previous.kind === 'CHAPTER_RESOLVED' ? 'CHAPTER' : 'DEVELOPMENT';
  }
  return {
    ...state,
    rngState: lottery.state,
    annualStories: next,
    pending: { kind: 'EVENT', eventId: selected.eventId, version: selected.version },
  };
}

export function resolveAnnualStory(
  state: CareerState,
  eventId: string,
  choiceId: string,
  outcome: ChapterOutcomeKind,
  revision: number,
): CareerState {
  if (
    state.rulesetVersion !== '3.5.0' ||
    state.annualStories === undefined ||
    !isAnnualStoryEvent(eventId)
  )
    return state;
  const family = OPEN_IDS[eventId] ?? FOLLOW_IDS[eventId];
  const initial = eventId in OPEN_IDS;
  return {
    ...state,
    annualStories: {
      ...state.annualStories,
      threads: state.annualStories.threads.map((thread) => {
        if (thread.family !== family || thread.stage !== (initial ? 'OPEN' : 'FOLLOW_UP'))
          return thread;
        return {
          ...thread,
          stage: initial && choiceId !== 'C' ? ('FOLLOW_UP' as const) : ('CLOSED' as const),
          ...(initial ? { choiceId, outcome } : {}),
          resolvedRevision: revision,
        };
      }),
    },
  };
}
