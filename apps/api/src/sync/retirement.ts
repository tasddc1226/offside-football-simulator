import { CareerStateSchema, type PutCareerBody } from '@offside/contracts';
import { loadRetirementArtifacts } from '@offside/content';
import {
  createCareerArchiveCore,
  createLegacyResult,
  type CareerState,
  type DomainSnapshot,
  type LegacyReferencePopulation,
} from '@offside/domain';
import { AppError } from '../errors.js';

/** Old/offline clients must not silently acquire a newer percentile when first synchronized. */
export function selectRetirementReferencePopulation(
  requestedId: PutCareerBody['retirementReferencePopulationId'],
  available: LegacyReferencePopulation | undefined,
): LegacyReferencePopulation | undefined {
  if (requestedId === undefined || requestedId === null) return undefined;
  if (available === undefined || available.id !== requestedId)
    throw new Error('Unknown retirement reference population');
  return available;
}

/** Pure archive validation/scoring, NOT per-command server simulation or an anti-cheat verdict. */
export function buildRetirementRows(
  careerId: string,
  createdServiceSeasonId: string,
  body: PutCareerBody,
  now: string,
) {
  try {
    const parsed: unknown = JSON.parse(body.snapshot.state);
    CareerStateSchema.parse(parsed);
    // Keep the original hashed object; schema parsers must not silently rewrite source bytes.
    const snapshot: DomainSnapshot = { ...body.snapshot, state: parsed as CareerState };
    const binding = {
      careerId,
      createdServiceSeasonId,
      rulesetVersion: body.rulesetVersion,
      contentPackVersion: body.contentPackVersion,
    };
    const artifacts = loadRetirementArtifacts(binding.rulesetVersion, binding.contentPackVersion);
    const context = {
      binding,
      artifacts,
    };
    const archive = createCareerArchiveCore(snapshot, context);
    const population = selectRetirementReferencePopulation(
      body.retirementReferencePopulationId,
      artifacts.legacyReferencePopulation,
    );
    const legacy = createLegacyResult(archive, context, population);
    return {
      careerId,
      retirementRevision: snapshot.revision,
      archiveHash: archive.hash,
      archiveJson: JSON.stringify(archive),
      legacyVersion: legacy.legacyVersion,
      legacyJson: JSON.stringify(legacy),
      createdAt: now,
    };
  } catch {
    throw new AppError({
      code: 'VALIDATION_FAILED',
      message: '은퇴 보관 기록을 검증할 수 없습니다.',
      details: { reason: 'INVALID_RETIREMENT_ARCHIVE' },
    });
  }
}
