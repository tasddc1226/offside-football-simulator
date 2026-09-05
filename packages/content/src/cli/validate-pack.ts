import { z } from 'zod';
import { ChapterDefinitionSchema, type ChapterDefinition } from '../schema/chapter.ts';
import { EventDefinitionSchema, type EventDefinition } from '../schema/event.ts';
import { PackManifestSchema, type PackManifest } from '../schema/pack.ts';
import { NarrativeDictionarySchema } from '../schema/narrative.ts';
import type { Condition } from '../schema/condition.ts';
import type { Ruleset } from '../schema/ruleset.ts';
import { NOT_MODELED_CONDITION_FIELDS } from '../runtime/condition-context.ts';
import { loadRuleset } from '../rulesets/load-ruleset.ts';
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

export function validatePack(
  pack: LoadedPack,
  options: { writeChecksum: boolean },
): PackValidationResult {
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
  checkPresentationFailSafety(events, errors);
  checkConstantFieldTriggers(events, warnings);
  if (manifestResult.success) {
    checkInjuryPreview(events, manifestResult.data.compatibleRulesetVersions, errors);
  }

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
    const missingFromManifest = [...pack.fileContents.keys()].filter(
      (f) => !manifestResult.data.files.includes(f),
    );
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

function checkDuplicateIds(
  events: { file: string; event: EventDefinition }[],
  errors: string[],
): void {
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
function checkDuplicateChapterIds(
  chapters: { file: string; chapter: ChapterDefinition }[],
  errors: string[],
): void {
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

function checkFollowUps(
  events: { file: string; event: EventDefinition }[],
  errors: string[],
): void {
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

function checkChoiceQuality(
  events: { file: string; event: EventDefinition }[],
  warnings: string[],
): void {
  for (const { file, event } of events) {
    for (const choice of event.choices) {
      const weightSum = choice.outcomes.reduce((sum, outcome) => sum + outcome.weight, 0);
      if (weightSum !== 100) {
        warnings.push(
          `${file}: 선택지 ${choice.id} outcome weight 합이 100이 아니다: ${weightSum}`,
        );
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

function checkCooldownWarning(
  events: { file: string; event: EventDefinition }[],
  warnings: string[],
): void {
  for (const { file, event } of events) {
    if (event.cooldown === undefined && event.weight >= 50) {
      warnings.push(`${file}: cooldown이 없는 고빈도(weight>=50) 이벤트다.`);
    }
  }
}

function checkMinorSafeWarning(
  events: { file: string; event: EventDefinition }[],
  warnings: string[],
): void {
  for (const { file, event } of events) {
    if (!event.safety.minorSafe && event.minAge === undefined) {
      warnings.push(`${file}: minorSafe가 false인데 minAge가 없다.`);
    }
  }
}

export function checkPresentationFailSafety(
  events: { file: string; event: EventDefinition }[],
  errors: string[],
): void {
  const presentations = new Set(['SLUMP', 'LOCKER_ROOM', 'ETHICS', 'MEDIA']);
  for (const { file, event } of events) {
    if (!event.presentation || !presentations.has(event.presentation)) continue;
    for (const choice of event.choices) {
      for (const outcome of choice.outcomes) {
        if (outcome.kind !== 'FAIL') continue;
        const hasFollowUp = (outcome.followUps?.length ?? 0) > 0;
        const hasPermanentNegative = outcome.effects.some(
          (effect) => effect.kind === 'PERMANENT' && effect.delta < 0,
        );
        if (hasPermanentNegative) {
          errors.push(
            `${file}: ${event.id}.${choice.id}.${outcome.id}: presentation FAIL outcome에 PERMANENT 음수 효과가 있다.`,
          );
        }
        const hasUnboundedTransientNegative = outcome.effects.some(
          (effect) =>
            (effect.kind === 'CURRENT' || effect.kind === 'CONTEXT') &&
            effect.delta < 0 &&
            effect.expiresAt === null,
        );
        if (!hasFollowUp && hasUnboundedTransientNegative) {
          errors.push(
            `${file}: ${event.id}.${choice.id}.${outcome.id}: presentation FAIL outcome 회복 경로가 없다.`,
          );
        }
      }
    }
  }
}

/** 조건 트리 리프가 참조하는 필드 경로를 전부 모은다(all/any/not은 재귀). */
function collectConditionFields(condition: Condition, fields: Set<string>): void {
  if ('all' in condition) {
    for (const child of condition.all) collectConditionFields(child, fields);
    return;
  }
  if ('any' in condition) {
    for (const child of condition.any) collectConditionFields(child, fields);
    return;
  }
  if ('not' in condition) {
    collectConditionFields(condition.not, fields);
    return;
  }
  if ('hasTag' in condition) {
    fields.add(condition.hasTag[0]);
    return;
  }
  if ('eq' in condition) {
    fields.add(condition.eq[0]);
    return;
  }
  if ('neq' in condition) {
    fields.add(condition.neq[0]);
    return;
  }
  if ('gt' in condition) {
    fields.add(condition.gt[0]);
    return;
  }
  if ('gte' in condition) {
    fields.add(condition.gte[0]);
    return;
  }
  if ('lt' in condition) {
    fields.add(condition.lt[0]);
    return;
  }
  if ('lte' in condition) {
    fields.add(condition.lte[0]);
    return;
  }
  if ('in' in condition) {
    fields.add(condition.in[0]);
    return;
  }
  if ('notIn' in condition) {
    fields.add(condition.notIn[0]);
  }
}

/**
 * F2(T-4-015): 감사 finding — 트리거가 아직 파생하지 않는 상수(NOT_MODELED) 필드만으로 구성되면
 * 그 이벤트는 상태와 무관하게 항상 같은 판정(예: EVT-CON-010의 season.stats.*가 상수 0이던 시절처럼
 * 영원히 거짓, 또는 영원히 참)이 나온다. `NOT_MODELED_CONDITION_FIELDS`(condition-context.ts가
 * 실제로 상수를 채우는 필드에서 직접 도출한 목록)만으로 트리거가 이뤄진 이벤트에 경고한다. 필드
 * 하나라도 실값 파생이면 경고하지 않는다(상수 필드는 보조 조건으로는 안전하게 쓸 수 있어서다).
 */
function checkConstantFieldTriggers(
  events: { file: string; event: EventDefinition }[],
  warnings: string[],
): void {
  const constantFields = new Set(NOT_MODELED_CONDITION_FIELDS);
  for (const { file, event } of events) {
    const fields = new Set<string>();
    collectConditionFields(event.triggers, fields);
    if (fields.size === 0) continue;
    if ([...fields].every((field) => constantFields.has(field))) {
      warnings.push(
        `${file}: ${event.id}: 트리거가 상수(NOT_MODELED) 필드만 참조한다(${[...fields].sort().join(', ')}) — 상태와 무관하게 항상 같은 판정이 나온다.`,
      );
    }
  }
}

const RETURN_SHIFT_LABEL_PATTERN = /복귀 경기 범위 이동:\s*([+-]?\d+)경기/;
const RECURRENCE_ADD_LABEL_PATTERN = /재발 위험:\s*([+-]?\d+)bp/;
const AVAILABILITY_LABEL_PATTERN = /출전 기회/;

/**
 * F4(T-4-015): presentation이 INJURY인 이벤트는 스키마가 이미 모든 choice에 rehabPlan을 강제한다
 * (event.ts superRefine). 이 검증기는 그 choice의 previewEffects 라벨이 (a) 복귀 범위·재발 위험·
 * 출전 기회 세 항목을 모두 담고 (b) 복귀 범위·재발 위험의 라벨 수치가 실제 `injuryRules.rehab[plan]`
 * (`returnShiftMatches`·`recurrenceAddBp`)과 일치하는지 대조한다. previewEffects는 자유 문자열이라
 * 팩 저작 중 룰셋 수치가 바뀌어도 라벨을 깜빡 놓치면 플레이어에게 잘못된 미리보기를 보여줄 수
 * 있다 — 이 검증기가 없으면 그 어긋남을 아무도 잡지 못한다.
 */
function checkInjuryPreview(
  events: { file: string; event: EventDefinition }[],
  compatibleRulesetVersions: readonly string[],
  errors: string[],
): void {
  const injuryChoices = events.flatMap(({ file, event }) =>
    event.presentation === 'INJURY'
      ? event.choices
          .filter((choice) => choice.rehabPlan !== undefined)
          .map((choice) => ({ file, event, choice }))
      : [],
  );
  if (injuryChoices.length === 0) return;

  const rulesets: Ruleset[] = [];
  for (const version of compatibleRulesetVersions) {
    try {
      rulesets.push(loadRuleset(version));
    } catch (error) {
      errors.push(
        `manifest.json: compatibleRulesetVersions: INJURY previewEffects를 대조할 룰셋 ${version}을 불러올 수 없다: ${(error as Error).message}`,
      );
    }
  }
  if (rulesets.length === 0) return;

  for (const { file, event, choice } of injuryChoices) {
    const plan = choice.rehabPlan!;
    const returnShiftPreview = choice.previewEffects.find((preview) => RETURN_SHIFT_LABEL_PATTERN.test(preview.label));
    const recurrencePreview = choice.previewEffects.find((preview) => RECURRENCE_ADD_LABEL_PATTERN.test(preview.label));
    const hasAvailabilityPreview = choice.previewEffects.some((preview) => AVAILABILITY_LABEL_PATTERN.test(preview.label));

    if (!returnShiftPreview) {
      errors.push(`${file}: ${event.id}.${choice.id}: INJURY choice previewEffects에 복귀 범위(availability.matchesRemaining) 항목이 없다.`);
    }
    if (!recurrencePreview) {
      errors.push(`${file}: ${event.id}.${choice.id}: INJURY choice previewEffects에 재발 위험(health.recurrenceRiskBp) 항목이 없다.`);
    }
    if (!hasAvailabilityPreview) {
      errors.push(`${file}: ${event.id}.${choice.id}: INJURY choice previewEffects에 출전 기회 항목이 없다.`);
    }

    for (const ruleset of rulesets) {
      const rule = ruleset.injuryRules.rehab[plan];

      if (returnShiftPreview) {
        const match = RETURN_SHIFT_LABEL_PATTERN.exec(returnShiftPreview.label);
        const labelValue = match ? Number(match[1]) : Number.NaN;
        if (labelValue !== rule.returnShiftMatches) {
          errors.push(
            `${file}: ${event.id}.${choice.id}: 복귀 범위 라벨(${returnShiftPreview.label})의 ${labelValue}경기가 injuryRules.rehab.${plan}.returnShiftMatches(${rule.returnShiftMatches})와 어긋난다.`,
          );
        }
      }
      if (recurrencePreview) {
        const match = RECURRENCE_ADD_LABEL_PATTERN.exec(recurrencePreview.label);
        const labelValue = match ? Number(match[1]) : Number.NaN;
        if (labelValue !== rule.recurrenceAddBp) {
          errors.push(
            `${file}: ${event.id}.${choice.id}: 재발 위험 라벨(${recurrencePreview.label})의 ${labelValue}bp가 injuryRules.rehab.${plan}.recurrenceAddBp(${rule.recurrenceAddBp})와 어긋난다.`,
          );
        }
      }
    }
  }
}
