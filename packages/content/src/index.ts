export const CONTENT_VERSION = '0.1.0';
export const PACK_0_1_0 = '0.1.0';
export { loadRetirementArtifacts, type RetirementArtifacts } from './retirement-artifacts.ts';
export { loadLegacyReferencePopulation } from './legacy/load-population.ts';

export {
  CONDITION_FIELDS,
  CONDITION_OPERATORS,
  CAREER_PHASES,
  SEASON_STATS,
  ConditionSchema,
  evaluateCondition,
  resolveConditionField,
  type Condition,
  type ConditionContext,
  type ConditionFieldSpec,
  type ConditionFieldType,
  type ConditionOperator,
  type SeasonStat,
} from './schema/condition.ts';

export {
  EffectSchema,
  EFFECT_DEFAULTS,
  EFFECT_KINDS,
  STACKING_RULES,
  PERMANENT_TARGETS,
  CURRENT_TARGETS,
  CONTEXT_TARGETS,
  RELATION_TARGETS,
  type EffectDefaults,
} from './schema/effect.ts';

export {
  NARRATIVE_TOKEN_KEYS,
  PARTICLE_PAIRS,
  NarrativeDictionarySchema,
  findNarrativeTokenIssues,
  type NarrativeTokenKey,
  type NarrativeTokenIssue,
  type NarrativeDictionary,
} from './schema/narrative.ts';

export {
  EVENT_ID_PATTERN,
  EventDefinitionSchema,
  ChoiceSchema,
  OutcomeSchema,
  CooldownSchema,
  SafetySchema,
  EffectPreviewSchema,
  NarrativeSchema,
  CHOICE_IDS,
  OUTCOME_KINDS,
  RISK_LABELS,
  type EventDefinition,
} from './schema/event.ts';

export {
  CHAPTER_ID_PATTERN,
  ChapterDefinitionSchema,
  ChapterDecisionSchema,
  ChapterOptionSchema,
  ChapterOutcomeSchema,
  ChapterEffectSchema,
  ChapterTriggerSchema,
  type ChapterDefinition,
} from './schema/chapter.ts';

export { PackManifestSchema, SemverSchema, type PackManifest } from './schema/pack.ts';

export {
  ATTRIBUTE_KEYS,
  ATTRIBUTE_KEY_COUNT,
  POSITIONS,
  RulesetSchema,
  ArchetypeSchema,
  BackgroundSchema,
  TeamSchema,
  OfferRulesSchema,
  ContractRulesSchema,
  type Position,
  type Archetype,
  type Background,
  type Team,
  type OfferRules,
  type ContractRules,
  type Ruleset,
} from './schema/ruleset.ts';

export { RulesetManifestSchema, type RulesetManifest } from './schema/ruleset-manifest.ts';

export { loadRuleset, RULESET_VERSIONS, type RulesetVersion } from './rulesets/load-ruleset.ts';

export { loadContentPack, PACK_VERSIONS, type ContentPack, type PackVersion } from './packs/load-content-pack.ts';

export { buildConditionContext } from './runtime/condition-context.ts';

export { selectEligibleEvents, type EligibleEvent } from './runtime/select-eligible-events.ts';

export { selectChapterCandidates, type ChapterCandidate } from './runtime/select-chapter-candidates.ts';
export { loadCharacterMemoryCopy, type CharacterMemoryCopy } from './character-memory.ts';
