import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadPack } from '../../src/cli/load-pack.ts';
import { validatePack } from '../../src/cli/validate-pack.ts';
import { EventDefinitionSchema } from '../../src/schema/event.ts';
import { PERMANENT_TARGETS, CURRENT_TARGETS, CONTEXT_TARGETS, RELATION_TARGETS } from '../../src/schema/effect.ts';

const PACK_DIR = dirname(fileURLToPath(import.meta.url));

describe('packs/0.2.0', () => {
  it('has exactly 19 events and 3 chapters that load and validate without errors', () => {
    const loaded = loadPack(PACK_DIR);
    expect(loaded.events).toHaveLength(19);
    expect(loaded.chapters).toHaveLength(3);

    const result = validatePack(loaded, { writeChecksum: false });
    expect(result.errors).toEqual([]);
    expect(result.eventCount).toBe(19);
    expect(result.chapterCount).toBe(3);
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

  it('checksum matches without --write-checksum', () => {
    const loaded = loadPack(PACK_DIR);
    const result = validatePack(loaded, { writeChecksum: false });
    expect(result.errors.filter((e) => e.includes('checksum'))).toEqual([]);
  });

  // T-3-006/T-4-003: 0.2.0의 신규 이벤트는 전부 PROTOTYPE 표시, 0.1.0에서 넘어온 10개는 표시가 없다
  // (0.1.0 정의는 바이트 동일 — U-013 (A)는 워커 신규 저작분만 PROTOTYPE으로 표시한다).
  it('새 이벤트 5개는 authoring이 PROTOTYPE이고 0.1.0 유래 10개는 authoring이 없다', () => {
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
    ]);
    for (const { raw } of loaded.events) {
      const event = EventDefinitionSchema.parse(raw);
      if (newIds.has(event.id)) {
        expect(event.authoring, event.id).toBe('PROTOTYPE');
      } else {
        expect(event.authoring, event.id).toBeUndefined();
      }
    }
  });
});
