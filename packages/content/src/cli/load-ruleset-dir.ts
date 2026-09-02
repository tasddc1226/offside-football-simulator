import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type LoadedRulesetDir = {
  dir: string;
  rulesetPath: string;
  manifestPath: string;
  rulesetRaw: unknown;
  manifestRaw: unknown;
};

function parseJsonFile(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Node 전용. `packages/content/src/schema/**`는 이 모듈을 import하지 않는다. */
export function loadRulesetDir(dir: string): LoadedRulesetDir {
  const rulesetPath = join(dir, 'ruleset.json');
  const manifestPath = join(dir, 'manifest.json');
  return {
    dir,
    rulesetPath,
    manifestPath,
    rulesetRaw: parseJsonFile(rulesetPath),
    manifestRaw: parseJsonFile(manifestPath),
  };
}
