import {
  canonicalize,
  simulate,
  type JsonValue,
  type SimulationInput,
  type SimulationResult,
} from '@offside/domain';

export interface Simulator {
  simulate(input: SimulationInput): Promise<SimulationResult>;
}

/** domain `simulate`를 같은 스레드에서 실행한다. Node·테스트·Worker 미지원 환경용. */
export const inlineSimulator: Simulator = {
  async simulate(input: SimulationInput): Promise<SimulationResult> {
    // New causal matches require authored command data on execute AND recovery/replay/Worker paths.
    // Historical commands retain their original contract and hashes.
    if (
      input.ruleset.matchDecisionRules !== undefined &&
      (input.command.type === 'ADVANCE' || input.command.type === 'RESOLVE_CHAPTER')
    ) {
      const invalid = (): SimulationResult => ({
        ok: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: '경기 판단이 저장된 콘텐츠 정의와 일치하지 않습니다.',
        },
      });
      try {
        const { loadContentPack, selectChapterCandidates } = await import('@offside/content');
        const pack = loadContentPack(input.contentPackVersion);
        const command = input.command;
        const state = input.snapshot?.state;
        if (state && command.type === 'ADVANCE') {
          if (
            canonicalize((command.payload.chapterCandidates ?? []) as unknown as JsonValue) !==
            canonicalize(selectChapterCandidates(pack, state) as unknown as JsonValue)
          )
            return invalid();
        }
        if (command.type === 'RESOLVE_CHAPTER') {
          const pending = state?.pending;
          if (pending?.kind !== 'CHAPTER') return invalid();
          const definition = pack.chaptersById.get(pending.chapterId);
          const decision = definition?.decisions[pending.resolved.length];
          const option = decision?.options.find(
            (candidate) => candidate.id === command.payload.optionId,
          );
          if (
            !definition ||
            definition.version !== pending.version ||
            command.payload.chapterId !== definition.id ||
            command.payload.definitionVersion !== definition.version ||
            command.payload.decisionId !== decision?.id ||
            !option
          )
            return invalid();
          const outcomes = option.outcomes.map(
            ({ id, kind, weight, effects, ratingDeltaTenths, addTags, removeTags }) => ({
              id,
              kind,
              weight,
              effects,
              ratingDeltaTenths,
              ...(addTags === undefined ? {} : { addTags }),
              ...(removeTags === undefined ? {} : { removeTags }),
            }),
          );
          if (
            canonicalize(command.payload.outcomes as unknown as JsonValue) !==
            canonicalize(outcomes as unknown as JsonValue)
          )
            return invalid();
        }
      } catch {
        return invalid();
      }
    }
    return simulate(input);
  },
};
