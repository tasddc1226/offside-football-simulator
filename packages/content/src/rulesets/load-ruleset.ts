import { RulesetSchema, type Ruleset } from '../schema/ruleset.ts';
import ruleset100 from '../../rulesets/1.0.0/ruleset.json' with { type: 'json' };
import ruleset110 from '../../rulesets/1.1.0/ruleset.json' with { type: 'json' };
import ruleset120 from '../../rulesets/1.2.0/ruleset.json' with { type: 'json' };
import ruleset130 from '../../rulesets/1.3.0/ruleset.json' with { type: 'json' };
import ruleset140 from '../../rulesets/1.4.0/ruleset.json' with { type: 'json' };

export const RULESET_VERSIONS = ['1.0.0', '1.1.0', '1.2.0', '1.3.0', '1.4.0'] as const;
export type RulesetVersion = (typeof RULESET_VERSIONS)[number];

const RULESET_SOURCES: Record<RulesetVersion, unknown> = {
  '1.0.0': ruleset100,
  '1.1.0': ruleset110,
  '1.2.0': ruleset120,
  '1.3.0': ruleset130,
  '1.4.0': ruleset140,
};

/** 번들에 포함된 룰셋 JSON을 `RulesetSchema`로 검증해 동기로 돌려준다. */
export function loadRuleset(version: string): Ruleset {
  if (!(RULESET_VERSIONS as readonly string[]).includes(version)) {
    throw new Error(`알 수 없는 rulesetVersion: ${version}`);
  }
  return RulesetSchema.parse(RULESET_SOURCES[version as RulesetVersion]);
}
