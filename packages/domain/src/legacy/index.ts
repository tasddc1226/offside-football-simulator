// Phase 5 staging boundary. Intentionally not exported by the shared domain barrel until integration.
export {
  assessRetirement,
  createRetirementDecision,
  resolveRetirementDecision,
  type RetirementIntent,
  type RetirementFacts,
  type RetirementPolicy,
  type RetirementAssessment,
  type RetirementBoundary,
  type RetirementChoice,
  type RetirementDecision,
  type RetirementResolution,
} from './retirement.js';
export {
  aggregateCareerRecords,
  type CareerRecords,
  type CareerRecordTotals,
} from './career-records.js';
export {
  calculateLegacyScore,
  legacyBandForScore,
  LEGACY_COMPONENT_WEIGHTS,
  type LegacyBandId,
  type LegacyComponentScores,
  type LegacyScoreSummary,
} from './score.js';
export {
  LEGACY_ENDING_PRIORITIES,
  resolveLegacyEndings,
  selectLegacyDisplayEnding,
  type LegacyEndingId,
  type LegacyEndingResolution,
} from './endings.js';
export {
  ArchiveError,
  createCareerArchiveCore,
  verifyCareerArchiveCore,
  planCareerArchiveWrite,
  type ArchiveArtifacts,
  type ArchiveCareerBinding,
  type ArchiveContext,
  type ArchiveErrorCode,
  type ArchiveWritePlan,
  type CareerArchiveCore,
} from './archive.js';
export {
  bindArchiveLegacyVersion,
  planArchiveLegacyBindingWrite,
  type ArchiveLegacyBinding,
  type LegacyDefinitionBinding,
} from './archive-legacy-binding.js';
