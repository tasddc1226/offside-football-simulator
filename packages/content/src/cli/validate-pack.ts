import { z } from 'zod';
import { ChapterDefinitionSchema, type ChapterDefinition } from '../schema/chapter.ts';
import { EventDefinitionSchema, type EventDefinition } from '../schema/event.ts';
import { PackManifestSchema, type PackManifest } from '../schema/pack.ts';
import { NarrativeDictionarySchema } from '../schema/narrative.ts';
import { canonicalStringify } from './canonical-json.ts';
import { computePackChecksum } from './checksum.ts';
import type { LoadedPack } from './load-pack.ts';

export type PackValidationResult = {
  eventCount: number;
  chapterCount: number;
  errors: string[];
  warnings: string[];
  computedChecksum: string;
  /** manifest.json이 스키마를 통과했을 때만 있다. `--write-checksum` 재기록에 쓴다. */
  manifest?: PackManifest;
};

function formatZodError(prefix: string, error: z.ZodError): string[] {
  return error.issues.map((issue) => `${prefix}: ${issue.path.join('.')}: ${issue.message}`);
}

export function validatePack(pack: LoadedPack, options: { writeChecksum: boolean }): PackValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const manifestResult = PackManifestSchema.safeParse(pack.manifestRaw);
  if (!manifestResult.success) {
    errors.push(...formatZodError('manifest.json', manifestResult.error));
  }

  const narrativeResult = NarrativeDictionarySchema.safeParse(pack.narrativeTokensRaw);
  if (!narrativeResult.success) {
    errors.push(...formatZodError(pack.narrativeTokensFile, narrativeResult.error));
  }

  const events: { file: string; event: EventDefinition }[] = [];
  for (const { file, raw } of pack.events) {
    const result = EventDefinitionSchema.safeParse(raw);
    if (!result.success) {
      errors.push(...formatZodError(file, result.error));
      continue;
    }
    events.push({ file, event: result.data });
  }

  checkDuplicateIds(events, errors);
  checkFollowUps(events, errors);
  checkChoiceQuality(events, warnings);
  checkCooldownWarning(events, warnings);
  checkMinorSafeWarning(events, warnings);

  const chapters: { file: string; chapter: ChapterDefinition }[] = [];
  for (const { file, raw } of pack.chapters) {
    const result = ChapterDefinitionSchema.safeParse(raw);
    if (!result.success) {
      errors.push(...formatZodError(file, result.error));
      continue;
    }
    chapters.push({ file, chapter: result.data });
  }
  checkDuplicateChapterIds(chapters, errors);

  // 목록에 있지만 실제로 없는 파일은 걸러낸다. 없는 파일을 그대로 넘기면
  // computePackChecksum이 undefined 콘텐츠로 해시를 시도해 예외를 던진다.
  // 그 경우는 missingOnDisk 에러로 이미 보고하므로 여기서는 조용히 제외한다.
  const filesForChecksum = (
    manifestResult.success ? manifestResult.data.files : [...pack.fileContents.keys()].sort()
  ).filter((file) => pack.fileContents.has(file));
  const computedChecksum = computePackChecksum(filesForChecksum, pack.fileContents);

  if (manifestResult.success) {
    const missingFromManifest = [...pack.fileContents.keys()].filter((f) => !manifestResult.data.files.includes(f));
    const missingOnDisk = manifestResult.data.files.filter((f) => !pack.fileContents.has(f));
    for (const file of missingFromManifest) {
      errors.push(`manifest.json: files: 팩에 있는 파일이 목록에 없다: ${file}`);
    }
    for (const file of missingOnDisk) {
      errors.push(`manifest.json: files: 목록에 있는 파일을 찾을 수 없다: ${file}`);
    }

    if (missingFromManifest.length === 0 && missingOnDisk.length === 0 && !options.writeChecksum) {
      if (manifestResult.data.checksum !== computedChecksum) {
        errors.push(
          `manifest.json: checksum: 불일치 (기록됨 ${manifestResult.data.checksum}, 계산됨 ${computedChecksum})`,
        );
      }
    }
  }

  return {
    eventCount: events.length,
    chapterCount: chapters.length,
    errors,
    warnings,
    computedChecksum,
    ...(manifestResult.success ? { manifest: manifestResult.data } : {}),
  };
}

function checkDuplicateIds(events: { file: string; event: EventDefinition }[], errors: string[]): void {
  const seen = new Map<string, string>();
  for (const { file, event } of events) {
    const existing = seen.get(event.id);
    if (existing) {
      errors.push(`${file}: id 중복: ${event.id} (${existing}와 중복)`);
      continue;
    }
    seen.set(event.id, file);
  }
}

// T-2-004 D-38.
function checkDuplicateChapterIds(chapters: { file: string; chapter: ChapterDefinition }[], errors: string[]): void {
  const seen = new Map<string, string>();
  for (const { file, chapter } of chapters) {
    const existing = seen.get(chapter.id);
    if (existing) {
      errors.push(`${file}: id 중복: ${chapter.id} (${existing}와 중복)`);
      continue;
    }
    seen.set(chapter.id, file);
  }
}

function checkFollowUps(events: { file: string; event: EventDefinition }[], errors: string[]): void {
  const knownIds = new Set(events.map(({ event }) => event.id));
  const edges = new Map<string, string[]>();

  for (const { file, event } of events) {
    const targets: string[] = [];
    for (const choice of event.choices) {
      for (const outcome of choice.outcomes) {
        for (const followUp of outcome.followUps ?? []) {
          targets.push(followUp.eventId);
          if (!knownIds.has(followUp.eventId)) {
            errors.push(`${file}: followUps.eventId가 팩에 없음: ${followUp.eventId}`);
          }
        }
      }
    }
    edges.set(event.id, targets);
  }

  const cycle = findCycle(edges);
  if (cycle) {
    errors.push(`followUps 순환 발견: ${cycle.join(' -> ')}`);
  }
}

function findCycle(edges: ReadonlyMap<string, string[]>): string[] | undefined {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  const stack: string[] = [];

  function visit(node: string): string[] | undefined {
    color.set(node, GRAY);
    stack.push(node);

    for (const next of edges.get(node) ?? []) {
      const nextColor = color.get(next) ?? WHITE;
      if (nextColor === GRAY) {
        const cycleStart = stack.indexOf(next);
        return [...stack.slice(cycleStart), next];
      }
      if (nextColor === WHITE) {
        const found = visit(next);
        if (found) return found;
      }
    }

    stack.pop();
    color.set(node, BLACK);
    return undefined;
  }

  for (const node of edges.keys()) {
    if ((color.get(node) ?? WHITE) === WHITE) {
      const found = visit(node);
      if (found) return found;
    }
  }
  return undefined;
}

function checkChoiceQuality(events: { file: string; event: EventDefinition }[], warnings: string[]): void {
  for (const { file, event } of events) {
    for (const choice of event.choices) {
      const weightSum = choice.outcomes.reduce((sum, outcome) => sum + outcome.weight, 0);
      if (weightSum !== 100) {
        warnings.push(`${file}: 선택지 ${choice.id} outcome weight 합이 100이 아니다: ${weightSum}`);
      }
    }

    for (let i = 0; i < event.choices.length; i += 1) {
      for (let j = i + 1; j < event.choices.length; j += 1) {
        const a = event.choices[i];
        const b = event.choices[j];
        if (!a || !b) continue;

        if (a.label === b.label) {
          warnings.push(`${file}: 선택지 ${a.id}·${b.id}의 label이 동일하다.`);
        }

        const effectsA = canonicalStringify(a.outcomes.map((outcome) => outcome.effects));
        const effectsB = canonicalStringify(b.outcomes.map((outcome) => outcome.effects));
        if (effectsA === effectsB && effectsA !== canonicalStringify([[]])) {
          warnings.push(`${file}: 선택지 ${a.id}·${b.id}의 effects가 canonical JSON으로 동일하다.`);
        }
      }
    }
  }
}

function checkCooldownWarning(events: { file: string; event: EventDefinition }[], warnings: string[]): void {
  for (const { file, event } of events) {
    if (event.cooldown === undefined && event.weight >= 50) {
      warnings.push(`${file}: cooldown이 없는 고빈도(weight>=50) 이벤트다.`);
    }
  }
}

function checkMinorSafeWarning(events: { file: string; event: EventDefinition }[], warnings: string[]): void {
  for (const { file, event } of events) {
    if (!event.safety.minorSafe && event.minAge === undefined) {
      warnings.push(`${file}: minorSafe가 false인데 minAge가 없다.`);
    }
  }
}
