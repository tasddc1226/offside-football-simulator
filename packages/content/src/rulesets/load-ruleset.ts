import ruleset310 from '../../rulesets/3.1.0/ruleset.json' with { type: 'json' };
import ruleset300 from '../../rulesets/3.0.0/ruleset.json' with { type: 'json' };
import ruleset210 from '../../rulesets/2.1.0/ruleset.json' with { type: 'json' };
import ruleset200 from '../../rulesets/2.0.0/ruleset.json' with { type: 'json' };
import { RulesetSchema, type Ruleset } from '../schema/ruleset.ts';
import ruleset100 from '../../rulesets/1.0.0/ruleset.json' with { type: 'json' };
import ruleset110 from '../../rulesets/1.1.0/ruleset.json' with { type: 'json' };
import ruleset120 from '../../rulesets/1.2.0/ruleset.json' with { type: 'json' };
import ruleset130 from '../../rulesets/1.3.0/ruleset.json' with { type: 'json' };
import ruleset140 from '../../rulesets/1.4.0/ruleset.json' with { type: 'json' };
import ruleset150 from '../../rulesets/1.5.0/ruleset.json' with { type: 'json' };
import ruleset160 from '../../rulesets/1.6.0/ruleset.json' with { type: 'json' };
import ruleset161 from '../../rulesets/1.6.1/ruleset.json' with { type: 'json' };
import ruleset170 from '../../rulesets/1.7.0/ruleset.json' with { type: 'json' };
import ruleset171 from '../../rulesets/1.7.1/ruleset.json' with { type: 'json' };
import ruleset172 from '../../rulesets/1.7.2/ruleset.json' with { type: 'json' };
import ruleset173 from '../../rulesets/1.7.3/ruleset.json' with { type: 'json' };
import ruleset174 from '../../rulesets/1.7.4/ruleset.json' with { type: 'json' };

export const RULESET_VERSIONS = [
  '1.0.0',
  '1.1.0',
  '1.2.0',
  '1.3.0',
  '1.4.0',
  '1.5.0',
  '1.6.0',
  '1.6.1',
  '1.7.0',
  '1.7.1',
  '1.7.2',
  '1.7.3',
  '1.7.4',
  '2.0.0',
  '2.1.0',
  '3.0.0',
  '3.1.0',
] as const;
export type RulesetVersion = (typeof RULESET_VERSIONS)[number];

const RULESET_SOURCES: Record<RulesetVersion, unknown> = {
  '1.0.0': ruleset100,
  '1.1.0': ruleset110,
  '1.2.0': ruleset120,
  '1.3.0': ruleset130,
  '1.4.0': ruleset140,
  '1.5.0': ruleset150,
  '1.6.0': ruleset160,
  '1.6.1': ruleset161,
  '1.7.0': ruleset170,
  '1.7.1': ruleset171,
  '1.7.2': ruleset172,
  '1.7.3': ruleset173,
  '1.7.4': ruleset174,
  '2.0.0': ruleset200,
  '2.1.0': ruleset210,
  '3.0.0': ruleset300,
  '3.1.0': ruleset310,
};

/** 번들에 포함된 룰셋 JSON을 `RulesetSchema`로 검증해 동기로 돌려준다. */
export function loadRuleset(version: string): Ruleset {
  if (!(RULESET_VERSIONS as readonly string[]).includes(version)) {
    throw new Error(`알 수 없는 rulesetVersion: ${version}`);
  }
  return RulesetSchema.parse(RULESET_SOURCES[version as RulesetVersion]);
}
