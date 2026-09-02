export const CONTENT_VERSION = '0.1.0';
export const PACK_0_1_0 = '0.1.0';

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

export { PackManifestSchema, SemverSchema, type PackManifest } from './schema/pack.ts';
