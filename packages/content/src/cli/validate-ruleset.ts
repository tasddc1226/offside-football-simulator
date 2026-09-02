import { z } from 'zod';
import { RulesetSchema } from '../schema/ruleset.ts';
import { RulesetManifestSchema, type RulesetManifest } from '../schema/ruleset-manifest.ts';
import { computeRulesetChecksum } from './checksum.ts';
import type { LoadedRulesetDir } from './load-ruleset-dir.ts';

export type RulesetValidationResult = {
  errors: string[];
  computedChecksum: string;
  /** manifest.json이 스키마를 통과했을 때만 있다. `--write-checksum` 재기록에 쓴다. */
  manifest?: RulesetManifest;
};

function formatZodError(prefix: string, error: z.ZodError): string[] {
  return error.issues.map((issue) => `${prefix}: ${issue.path.join('.')}: ${issue.message}`);
}

export function validateRulesetDir(
  loaded: LoadedRulesetDir,
  options: { writeChecksum: boolean },
): RulesetValidationResult {
  const errors: string[] = [];

  const rulesetResult = RulesetSchema.safeParse(loaded.rulesetRaw);
  if (!rulesetResult.success) {
    errors.push(...formatZodError('ruleset.json', rulesetResult.error));
  }

  const manifestResult = RulesetManifestSchema.safeParse(loaded.manifestRaw);
  if (!manifestResult.success) {
    errors.push(...formatZodError('manifest.json', manifestResult.error));
  }

  const computedChecksum = computeRulesetChecksum(loaded.rulesetRaw);

  if (rulesetResult.success && manifestResult.success) {
    if (manifestResult.data.version !== rulesetResult.data.version) {
      errors.push(
        `manifest.json: version: ruleset.json의 version과 다르다 (manifest ${manifestResult.data.version}, ruleset ${rulesetResult.data.version})`,
      );
    }
    if (!options.writeChecksum && manifestResult.data.checksum !== computedChecksum) {
      errors.push(
        `manifest.json: checksum: 불일치 (기록됨 ${manifestResult.data.checksum}, 계산됨 ${computedChecksum})`,
      );
    }
  }

  return {
    errors,
    computedChecksum,
    ...(manifestResult.success ? { manifest: manifestResult.data } : {}),
  };
}
