import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadPack } from '../../src/cli/load-pack.ts';
import { validatePack } from '../../src/cli/validate-pack.ts';
import { ChapterDefinitionSchema } from '../../src/schema/chapter.ts';
import { EventDefinitionSchema } from '../../src/schema/event.ts';
import { PERMANENT_TARGETS, CURRENT_TARGETS, CONTEXT_TARGETS, RELATION_TARGETS } from '../../src/schema/effect.ts';

const PACK_DIR = dirname(fileURLToPath(import.meta.url));

describe('packs/0.2.0', () => {
  it('has exactly 20 events and 4 chapters that load and validate without errors', () => {
    const loaded = loadPack(PACK_DIR);
    expect(loaded.events).toHaveLength(20);
    expect(loaded.chapters).toHaveLength(4);

    const result = validatePack(loaded, { writeChecksum: false });
    expect(result.errors).toEqual([]);
    expect(result.eventCount).toBe(20);
    expect(result.chapterCount).toBe(4);
  });

  it('every chapter id is unique', () => {
    const loaded = loadPack(PACK_DIR);
    const ids = loaded.chapters.map((c) => (c.raw as { id: string }).id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every event id is unique', () => {
    const loaded = loadPack(PACK_DIR);
    const ids = loaded.events.map((e) => (e.raw as { id: string }).id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every choice outcome weight sums to 100', () => {
    const loaded = loadPack(PACK_DIR);
    for (const { file, raw } of loaded.events) {
      const event = EventDefinitionSchema.parse(raw);
      for (const choice of event.choices) {
        const sum = choice.outcomes.reduce((total, outcome) => total + outcome.weight, 0);
        expect(sum, `${file} choice ${choice.id}`).toBe(100);
      }
    }
  });

  it('every outcome sourceId is unique across the pack', () => {
    const loaded = loadPack(PACK_DIR);
    const sourceIds: string[] = [];
    for (const { raw } of loaded.events) {
      const event = EventDefinitionSchema.parse(raw);
      for (const choice of event.choices) {
        for (const outcome of choice.outcomes) {
          for (const effect of outcome.effects) {
            sourceIds.push(effect.sourceId);
          }
        }
      }
    }
    expect(new Set(sourceIds).size).toBe(sourceIds.length);
  });

  it('every effect target is a valid domain key for its kind', () => {
    const loaded = loadPack(PACK_DIR);
    const allTargets = new Set<string>([
      ...PERMANENT_TARGETS,
      ...CURRENT_TARGETS,
      ...CONTEXT_TARGETS,
      ...RELATION_TARGETS,
    ]);

    for (const { raw } of loaded.events) {
      const event = EventDefinitionSchema.parse(raw);
      for (const choice of event.choices) {
        for (const outcome of choice.outcomes) {
          for (const effect of outcome.effects) {
            expect(allTargets.has(effect.target)).toBe(true);
          }
        }
      }
    }
  });

  it('NATIONAL_DEBUT keeps the PROTOTYPE/no-rating preview contract', () => {
    const loaded = loadPack(PACK_DIR);
    const chapter = loaded.chapters.find(({ raw }) => (raw as { id: string }).id === 'CHP-NAT-001');
    if (chapter === undefined) throw new Error('CHP-NAT-001 is missing');
    const definition = ChapterDefinitionSchema.parse(chapter.raw);
    expect((chapter.raw as Record<string, unknown>).authoring).toBe('PROTOTYPE');
    expect(loaded.manifestRaw).toMatchObject({ playtested: false });
    for (const option of definition.decisions.flatMap((decision) => decision.options)) {
      expect(option.outcomes.every((outcome) => outcome.ratingDeltaTenths === 0)).toBe(true);
    }
    const event = loaded.events.find(({ raw }) => (raw as { id: string }).id === 'EVT-NAT-001');
    if (event === undefined) throw new Error('EVT-NAT-001 is missing');
    const eventDefinition = EventDefinitionSchema.parse(event.raw);
    for (const choice of eventDefinition.choices) {
      expect(choice.previewEffects.some((preview) => preview.label === '특례 규칙: 적용 없음')).toBe(true);
    }
  });

  it('checksum matches without --write-checksum', () => {
    const loaded = loadPack(PACK_DIR);
    const result = validatePack(loaded, { writeChecksum: false });
    expect(result.errors.filter((e) => e.includes('checksum'))).toEqual([]);
  });

  // T-3-006/T-4-002/T-4-003/T-4-004: 신규 이벤트와 문구가 바뀐 EVT-INJ-001은 PROTOTYPE으로 표시한다.
  // 나머지 0.1.0 유래 이벤트는 authoring이 없다.
  it('신규 이벤트와 문구가 바뀐 EVT-INJ-001은 authoring이 PROTOTYPE이다', () => {
    const loaded = loadPack(PACK_DIR);
    const newIds = new Set([
      'EVT-CON-010',
      'EVT-CON-011',
      'EVT-CON-012',
      'EVT-CON-013',
      'EVT-MEDIA-006',
      'EVT-SLUMP-010',
      'EVT-REL-010',
      'EVT-ETH-010',
      'EVT-MEDIA-010',
      'EVT-NAT-001',
    ]);
    const changedIds = new Set([...newIds, 'EVT-INJ-001']);
    for (const { raw } of loaded.events) {
      const event = EventDefinitionSchema.parse(raw);
      if (changedIds.has(event.id)) {
        expect(event.authoring, event.id).toBe('PROTOTYPE');
      } else {
        expect(event.authoring, event.id).toBeUndefined();
      }
    }
  });
});
