import { clamp } from './clamp.js';
import type { Ruleset } from './ruleset.js';
import type {
  CareerState,
  CoachChoiceMemory,
  CoachMemoryState,
  MatchRecord,
  SeasonManager,
} from './types.js';

const empty = (): CoachMemoryState => ({
  version: 'COACH_MEMORY_V1',
  memories: [],
  reactions: [],
  consumed: [],
});

/** Called only after an actual club chapter choice resolves. No attribution of historical generic logs. */
export function rememberCoachChoice(
  state: CareerState,
  ruleset: Ruleset,
  choice: {
    chapterId: string;
    decisionId: string;
    optionId: string;
    match: MatchRecord;
  },
): CareerState {
  const rule = ruleset.characterMemoryRules;
  const season = state.season;
  const actor = season?.manager;
  const impact = choice.match.decisionImpact?.receipts.find(
    (receipt) => receipt.decisionId === choice.decisionId,
  );
  if (!rule || !season || !actor || !impact) return state;
  const current = state.characterMemory ?? empty();
  const id = `${season.index}:${choice.match.id}:${choice.chapterId}:${choice.decisionId}`;
  if (current.memories.some((memory) => memory.id === id)) return state;
  const memory: CoachChoiceMemory = {
    id,
    actor: { id: actor.id, name: actor.name, teamId: season.teamId },
    seasonIndex: season.index,
    step: choice.match.step,
    matchId: choice.match.id,
    chapterId: choice.chapterId,
    decisionId: choice.decisionId,
    optionId: choice.optionId,
    action: impact.action,
    outcomeKind: impact.outcomeKind,
    before: { ...impact.before },
    after: { ...impact.after },
    trustDelta: impact.managerTrustDelta,
  };
  const memories = [...current.memories, memory].slice(-rule.memoryMax);
  return {
    ...state,
    characterMemory: {
      ...current,
      memories,
      consumed: current.consumed.filter((entry) =>
        memories.some((item) => item.id === entry.memoryId),
      ),
    },
  };
}

/** Reactions happen at the real next-season boundary, before selection uses manager trust. */
export function reactToCoachMemory(
  state: CareerState,
  ruleset: Ruleset,
  manager: SeasonManager,
  teamId: string,
  trustBefore: number,
): {
  characterMemory: CoachMemoryState | undefined;
  managerTrust: number;
} {
  const rule = ruleset.characterMemoryRules;
  const current = state.characterMemory;
  const unchanged = { characterMemory: current, managerTrust: trustBefore };
  if (!rule || !current) return unchanged;
  const seasonIndex = state.seasonHistory.length + 1;
  const memory = current.memories.findLast(
    (candidate) =>
      candidate.actor.id === manager.id &&
      candidate.actor.name === manager.name &&
      candidate.actor.teamId === teamId &&
      candidate.seasonIndex < seasonIndex,
  );
  if (!memory) return unchanged;
  const previous = state.seasonHistory.at(-1);
  const continuing = previous?.teamId === teamId && previous.result.managerId === manager.id;
  const returned =
    previous !== undefined &&
    previous.teamId !== teamId &&
    state.seasonHistory.some(
      (season) => season.index > memory.seasonIndex && season.teamId !== teamId,
    );
  if (!continuing && !returned) return unchanged;
  // One response to a remembered choice; a genuine reunion can recall it once more.
  const kind = returned ? 'REUNION' : 'FOLLOW_UP';
  if (
    current.reactions.some((reaction) => reaction.seasonIndex === seasonIndex) ||
    current.consumed.some((entry) => entry.kind === kind && entry.memoryId === memory.id)
  )
    return unchanged;
  const requested =
    memory.outcomeKind === 'SUCCESS'
      ? rule.successTrustDelta
      : memory.outcomeKind === 'FAIL'
        ? rule.failTrustDelta
        : 0;
  const managerTrust = clamp(trustBefore + requested, 0, 100);
  const reaction = {
    id: `${seasonIndex}:${manager.id}:${kind}`,
    kind,
    seasonIndex,
    actor: { id: manager.id, name: manager.name, teamId },
    memory,
    trustBefore,
    trustAfter: managerTrust,
    trustDelta: managerTrust - trustBefore,
  } as const;
  return {
    managerTrust,
    characterMemory: {
      ...current,
      reactions: [...current.reactions, reaction].slice(-rule.reactionMax),
      consumed: [...current.consumed, { memoryId: memory.id, kind }],
    },
  };
}
