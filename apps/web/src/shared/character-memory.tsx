import { loadCharacterMemoryCopy } from '@offside/content';
import type { CareerState, CoachChoiceMemory, CoachMemoryReaction } from '@offside/domain';
import { contentForCareer } from '../engine/content.js';

type MemoryState = Pick<CareerState, 'contentPackVersion' | 'characterMemory' | 'season'>;
type Copy = NonNullable<ReturnType<typeof loadCharacterMemoryCopy>>;
const signed = (value: number) => `${value > 0 ? '+' : ''}${value}`;

export function hasCharacterChoiceMemory(
  state: MemoryState,
  matchId: string,
  decisionId: string,
): boolean {
  return characterChoiceTrustDelta(state, matchId, decisionId) !== null;
}

export function characterChoiceTrustDelta(
  state: MemoryState,
  matchId: string,
  decisionId: string,
): number | null {
  if (
    loadCharacterMemoryCopy(state.contentPackVersion) === null ||
    state.characterMemory?.version !== 'COACH_MEMORY_V1'
  )
    return null;
  return (
    state.characterMemory.memories.find(
      (memory) => memory.matchId === matchId && memory.decisionId === decisionId,
    )?.trustDelta ?? null
  );
}

/** Only explicitly authored tokens, filled from the immutable source choice, never today's coach. */
function memorySentence(template: string, memory: CoachChoiceMemory, copy: Copy): string {
  return template
    .replaceAll('{coach}', memory.actor.name)
    .replaceAll('{season}', String(memory.seasonIndex))
    .replaceAll('{action}', copy.actions[memory.action])
    .replaceAll('{outcome}', copy.outcomes[memory.outcomeKind]);
}

function choiceLabel(state: MemoryState, memory: CoachChoiceMemory, copy: Copy): string {
  const chapter = contentForCareer(state).chapters.find((entry) => entry.id === memory.chapterId);
  return (
    chapter?.decisions
      .find((entry) => entry.id === memory.decisionId)
      ?.options.find((entry) => entry.id === memory.optionId)?.label ?? copy.actions[memory.action]
  );
}

function SourceChoice({
  state,
  memory,
  copy,
}: {
  state: MemoryState;
  memory: CoachChoiceMemory;
  copy: Copy;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-os-1 text-os-text-2 [overflow-wrap:anywhere]">
      <p>
        {memory.seasonIndex}시즌 · {memory.step}단계에 남긴 선택
      </p>
      <p>내 선택: {choiceLabel(state, memory, copy)}</p>
      <p>
        당시 판정: {copy.outcomes[memory.outcomeKind]} · {copy.actions[memory.action]}
      </p>
      <p>
        당시 스코어 {memory.before.goalsFor}:{memory.before.goalsAgainst} → {memory.after.goalsFor}:
        {memory.after.goalsAgainst}
      </p>
      <p>선택 당시 감독 신뢰 변화 {signed(memory.trustDelta)}</p>
    </div>
  );
}

function ReactionCard({
  state,
  reaction,
  copy,
}: {
  state: MemoryState;
  reaction: CoachMemoryReaction;
  copy: Copy;
}) {
  const reunion = reaction.kind === 'REUNION';
  return (
    <article
      className="flex min-w-0 flex-col gap-os-2 rounded-os-m bg-os-surface-2 p-os-3 [overflow-wrap:anywhere]"
      aria-label={`${reaction.seasonIndex}시즌 ${reunion ? '감독과 재회' : '감독의 후속 반응'}`}
    >
      <h3 className="font-semibold text-os-text">
        {reunion ? copy.reunionTitle : copy.followUpTitle}
      </h3>
      <p>
        {reaction.seasonIndex}시즌 · {reaction.actor.name} 감독
      </p>
      <p>{memorySentence(reunion ? copy.reunion : copy.followUp, reaction.memory, copy)}</p>
      <p>
        이번 반응의 감독 신뢰 {reaction.trustBefore} → {reaction.trustAfter} (
        {signed(reaction.trustDelta)})
      </p>
      <details className="sim-disclosure">
        <summary>기억의 바탕이 된 내 선택</summary>
        <SourceChoice state={state} memory={reaction.memory} copy={copy} />
      </details>
    </article>
  );
}

/** Historical careers/data without this opt-in policy keep exactly their previous presentation. */
export function CharacterMemoryPanel({
  state,
  matchId,
  decisionId,
  currentSeasonOnly = false,
}: {
  state: MemoryState;
  matchId?: string;
  decisionId?: string;
  currentSeasonOnly?: boolean;
}) {
  const history = state.characterMemory;
  if (!history || history.version !== 'COACH_MEMORY_V1') return null;
  const copy = loadCharacterMemoryCopy(state.contentPackVersion);
  if (!copy) return null;
  const memories = currentSeasonOnly
    ? []
    : history.memories
        .filter(
          (memory) =>
            (matchId === undefined || memory.matchId === matchId) &&
            (decisionId === undefined || memory.decisionId === decisionId),
        )
        .slice(-3)
        .reverse();
  const reactions =
    matchId !== undefined
      ? []
      : history.reactions
          .filter((reaction) => !currentSeasonOnly || reaction.seasonIndex === state.season?.index)
          .slice(currentSeasonOnly ? -1 : -3)
          .reverse();
  if (memories.length === 0 && reactions.length === 0) return null;
  return (
    <section
      className="flex min-w-0 flex-col gap-os-3"
      aria-label={currentSeasonOnly ? '이번 시즌 인물의 반응' : '함께한 인물의 기억'}
    >
      {reactions.map((reaction) => (
        <ReactionCard key={reaction.id} state={state} reaction={reaction} copy={copy} />
      ))}
      {memories.map((memory) => (
        <article
          key={memory.id}
          className="flex min-w-0 flex-col gap-os-2 rounded-os-m bg-os-surface-2 p-os-3 [overflow-wrap:anywhere]"
          aria-label={`${memory.actor.name} 감독이 기억한 선택`}
        >
          <h3 className="font-semibold text-os-text">{copy.rememberedTitle}</h3>
          <p>
            {memory.actor.name} 감독 · {memory.seasonIndex}시즌
          </p>
          <p>{memorySentence(copy.remembered, memory, copy)}</p>
          <SourceChoice state={state} memory={memory} copy={copy} />
        </article>
      ))}
    </section>
  );
}
