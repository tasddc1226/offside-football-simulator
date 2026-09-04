import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadPack } from '../../src/cli/load-pack.ts';
import { validatePack } from '../../src/cli/validate-pack.ts';
import { EventDefinitionSchema } from '../../src/schema/event.ts';
import { PERMANENT_TARGETS, CURRENT_TARGETS, CONTEXT_TARGETS, RELATION_TARGETS } from '../../src/schema/effect.ts';

const PACK_DIR = dirname(fileURLToPath(import.meta.url));

describe('packs/0.1.0', () => {
  it('has exactly 11 events and 4 chapters that load and validate without errors', () => {
    const loaded = loadPack(PACK_DIR);
    expect(loaded.events).toHaveLength(11);
    expect(loaded.chapters).toHaveLength(4);

    const result = validatePack(loaded, { writeChecksum: false });
    expect(result.errors).toEqual([]);
    expect(result.eventCount).toBe(11);
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

  it('checksum matches without --write-checksum', () => {
    const loaded = loadPack(PACK_DIR);
    const result = validatePack(loaded, { writeChecksum: false });
    expect(result.errors.filter((e) => e.includes('checksum'))).toEqual([]);
  });
});
