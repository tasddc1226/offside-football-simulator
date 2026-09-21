import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export type LoadedPack = {
  dir: string;
  manifestPath: string;
  manifestRaw: unknown;
  events: { file: string; raw: unknown }[];
  // T-2-004 D-38.
  chapters: { file: string; raw: unknown }[];
  narrativeTokensFile: string;
  narrativeTokensRaw: unknown;
  /** manifest.files와 같은 상대 경로를 키로 쓰는 파싱된 JSON. checksum 계산에 쓴다. */
  fileContents: ReadonlyMap<string, unknown>;
};

function parseJsonFile(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Node 전용. `packages/content/src/schema/**`는 이 모듈을 import하지 않는다. */
export function loadPack(dir: string): LoadedPack {
  const manifestPath = join(dir, 'manifest.json');
  const manifestRaw = parseJsonFile(manifestPath);

  const eventsDir = join(dir, 'events');
  const eventFileNames = readdirSync(eventsDir)
    .filter((name) => name.endsWith('.json'))
    .sort();
  const events = eventFileNames.map((name) => ({
    file: `events/${name}`,
    raw: parseJsonFile(join(eventsDir, name)),
  }));

  const chaptersDir = join(dir, 'chapters');
  const chapterFileNames = existsSync(chaptersDir)
    ? readdirSync(chaptersDir)
        .filter((name) => name.endsWith('.json'))
        .sort()
    : [];
  const chapters = chapterFileNames.map((name) => ({
    file: `chapters/${name}`,
    raw: parseJsonFile(join(chaptersDir, name)),
  }));

  const narrativeTokensFile = 'narrative/tokens.json';
  const narrativeTokensRaw = parseJsonFile(join(dir, 'narrative', 'tokens.json'));

  const fileContents = new Map<string, unknown>();
  for (const event of events) fileContents.set(event.file, event.raw);
  for (const chapter of chapters) fileContents.set(chapter.file, chapter.raw);
  fileContents.set(narrativeTokensFile, narrativeTokensRaw);
  const coachMemoryFile = 'narrative/coach-memory.json';
  if (existsSync(join(dir, coachMemoryFile))) fileContents.set(coachMemoryFile, parseJsonFile(join(dir, coachMemoryFile)));

  return { dir, manifestPath, manifestRaw, events, chapters, narrativeTokensFile, narrativeTokensRaw, fileContents };
}
