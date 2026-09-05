// Phase 5 staging boundary. Intentionally not exported by the shared domain barrel until integration.
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
