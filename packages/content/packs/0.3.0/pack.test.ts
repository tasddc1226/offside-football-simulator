import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadPack } from '../../src/cli/load-pack.ts';
import { validatePack } from '../../src/cli/validate-pack.ts';
import { ChapterDefinitionSchema } from '../../src/schema/chapter.ts';
import { EventDefinitionSchema, PRESENTATION_KINDS } from '../../src/schema/event.ts';
import { PERMANENT_TARGETS, CURRENT_TARGETS, CONTEXT_TARGETS, RELATION_TARGETS } from '../../src/schema/effect.ts';

const PACK_DIR = dirname(fileURLToPath(import.meta.url));

// T-4-008: packs/0.2.0/pack.test.ts와 같은 골격 + 0.3.0이 새로 더한 항목(presentation별 수,
// 포지션군별 챕터 존재, FAIL 회복 경로)을 더한다.
describe('packs/0.3.0', () => {
  it('has exactly 32 events and 7 chapters that load and validate without errors', () => {
    const loaded = loadPack(PACK_DIR);
    expect(loaded.events).toHaveLength(32);
    expect(loaded.chapters).toHaveLength(7);

    const result = validatePack(loaded, { writeChecksum: false });
    expect(result.errors).toEqual([]);
    expect(result.eventCount).toBe(32);
    expect(result.chapterCount).toBe(7);
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

  // T-4-008: 0.2.0에서 넘어온 정의(EVT-INJ-001 포함) + 이번 작업이 새로 더한 12개 이벤트는
  // authoring이 PROTOTYPE이다. 그 외 0.1.0 유래 정의는 authoring이 없다.
  it('0.2.0에서 이미 PROTOTYPE이었던 이벤트와 이번에 새로 더한 12개는 authoring이 PROTOTYPE이다', () => {
    const loaded = loadPack(PACK_DIR);
    const carriedOverIds = new Set([
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
      'EVT-INJ-001',
    ]);
    const newIds = new Set([
      'EVT-INJ-003',
      'EVT-INJ-004',
      'EVT-REL-003',
      'EVT-REL-005',
      'EVT-REL-008',
      'EVT-MGR-003',
      'EVT-MGR-004',
      'EVT-SLUMP-011',
      'EVT-ETH-011',
      'EVT-MEDIA-002',
      'EVT-MEDIA-004',
      'EVT-NAT-002',
    ]);
    expect(newIds.size).toBe(12);
    const prototypeIds = new Set([...carriedOverIds, ...newIds]);
    for (const { raw } of loaded.events) {
      const event = EventDefinitionSchema.parse(raw);
      if (prototypeIds.has(event.id)) {
        expect(event.authoring, event.id).toBe('PROTOTYPE');
      } else {
        expect(event.authoring, event.id).toBeUndefined();
      }
    }
  });

  // T-4-008 0절: presentation별 실제 수(일반 EVENT 슬롯이 고르는 것 vs 전용 생성기 전용).
  it('presentation별 이벤트 수가 설계와 일치한다', () => {
    const loaded = loadPack(PACK_DIR);
    const counts: Record<string, number> = { NONE: 0 };
    for (const kind of PRESENTATION_KINDS) counts[kind] = 0;
    for (const { raw } of loaded.events) {
      const event = EventDefinitionSchema.parse(raw);
      const key = event.presentation ?? 'NONE';
      counts[key] = (counts[key] ?? 0) + 1;
    }
    // NONE(일반, presentation 없음): 0.1.0 유래 8개(CON-001/002/003, DEV-001/002, MGR-001,
    // REL-001/002) + 0.2.0 신규(CON-010~013는 RUMOUR·나머지 NONE 아님, 아래 개별 카운트 참고) +
    // T-4-008 신규 NONE 6개(INJ-003/004, REL-003/008, MGR-003/004, NAT-002).
    expect(counts.INJURY).toBe(1); // EVT-INJ-001
    expect(counts.NATIONAL_TEAM).toBe(1); // EVT-NAT-001
    expect(counts.RUMOUR).toBe(1); // EVT-CON-010
    expect(counts.SLUMP).toBe(2); // EVT-SLUMP-010/011
    expect(counts.LOCKER_ROOM).toBe(2); // EVT-REL-010, EVT-REL-005
    expect(counts.ETHICS).toBe(2); // EVT-ETH-010/011
    expect(counts.MEDIA).toBe(3); // EVT-MEDIA-010, EVT-MEDIA-002/004(EVT-MEDIA-006은 presentation 없음)
    expect(counts.NONE).toBe(20);
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
    expect(total).toBe(32);
  });

  // T-4-008 1절: 포지션 전용 챕터 3종이 각 포지션군에 존재한다(존재만 확인, 도달성은 별도 파일).
  it('GK·DF·FW 전용 챕터가 각각 존재하고 positionGroups가 정확하다', () => {
    const loaded = loadPack(PACK_DIR);
    const byId = new Map(loaded.chapters.map(({ raw }) => [(raw as { id: string }).id, raw]));
    const gk = ChapterDefinitionSchema.parse(byId.get('CHP-MATCH-005'));
    const df = ChapterDefinitionSchema.parse(byId.get('CHP-MATCH-006'));
    const fw = ChapterDefinitionSchema.parse(byId.get('CHP-MATCH-007'));
    expect(gk.positionGroups).toEqual(['GK']);
    expect(df.positionGroups).toEqual(['DF']);
    expect(fw.positionGroups).toEqual(['FW']);
    expect(gk.authoring).toBe('PROTOTYPE');
    expect(df.authoring).toBe('PROTOTYPE');
    expect(fw.authoring).toBe('PROTOTYPE');
  });

  it('포지션 전용 챕터 3종은 이름만 바꾼 동일 choice 세트가 아니다(옵션 id·효과가 서로 다르다)', () => {
    const loaded = loadPack(PACK_DIR);
    const byId = new Map(loaded.chapters.map(({ raw }) => [(raw as { id: string }).id, raw]));
    const gk = ChapterDefinitionSchema.parse(byId.get('CHP-MATCH-005'));
    const df = ChapterDefinitionSchema.parse(byId.get('CHP-MATCH-006'));
    const fw = ChapterDefinitionSchema.parse(byId.get('CHP-MATCH-007'));
    const optionIds = (chapter: typeof gk) => chapter.decisions[0]!.options.map((o) => o.id).sort();
    const gkIds = optionIds(gk);
    const dfIds = optionIds(df);
    const fwIds = optionIds(fw);
    expect(gkIds).not.toEqual(dfIds);
    expect(dfIds).not.toEqual(fwIds);
    expect(gkIds).not.toEqual(fwIds);
  });

  // T-4-008: presentation이 SLUMP/LOCKER_ROOM/ETHICS/MEDIA인 새 이벤트의 FAIL outcome에는
  // 회복 경로(PERMANENT 음수 없음 + CURRENT/CONTEXT 음수는 만료가 있음)가 있다.
  it('새로 더한 presentation 이벤트의 FAIL outcome은 회복 경로를 가진다', () => {
    const loaded = loadPack(PACK_DIR);
    const targetIds = new Set(['EVT-REL-005', 'EVT-SLUMP-011', 'EVT-ETH-011', 'EVT-MEDIA-002', 'EVT-MEDIA-004']);
    for (const { raw } of loaded.events) {
      const event = EventDefinitionSchema.parse(raw);
      if (!targetIds.has(event.id)) continue;
      for (const choice of event.choices) {
        for (const outcome of choice.outcomes) {
          if (outcome.kind !== 'FAIL') continue;
          const hasPermanentNegative = outcome.effects.some((effect) => effect.kind === 'PERMANENT' && effect.delta < 0);
          expect(hasPermanentNegative, `${event.id}.${choice.id}.${outcome.id}`).toBe(false);
          const hasUnboundedTransientNegative = outcome.effects.some(
            (effect) => (effect.kind === 'CURRENT' || effect.kind === 'CONTEXT') && effect.delta < 0 && effect.expiresAt === null,
          );
          const hasFollowUp = (outcome.followUps?.length ?? 0) > 0;
          expect(hasUnboundedTransientNegative && !hasFollowUp, `${event.id}.${choice.id}.${outcome.id}`).toBe(false);
        }
      }
    }
  });

  // T-4-008: EVT-INJ-003·EVT-INJ-004는 HEALTH kind Effect를 쓰지 않는다(ADR-010: T-4-002 재활만).
  it('EVT-INJ-003·EVT-INJ-004는 HEALTH kind Effect를 쓰지 않는다', () => {
    const loaded = loadPack(PACK_DIR);
    for (const { raw } of loaded.events) {
      const event = EventDefinitionSchema.parse(raw);
      if (event.id !== 'EVT-INJ-003' && event.id !== 'EVT-INJ-004') continue;
      for (const choice of event.choices) {
        for (const outcome of choice.outcomes) {
          for (const effect of outcome.effects) {
            expect(effect.kind, `${event.id}.${choice.id}.${outcome.id}`).not.toBe('HEALTH');
          }
        }
      }
    }
  });
});
