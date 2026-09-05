import { ChapterDefinitionSchema, type ChapterDefinition } from '../schema/chapter.ts';
import { EventDefinitionSchema, type EventDefinition } from '../schema/event.ts';
import { PackManifestSchema, type PackManifest } from '../schema/pack.ts';
import { NarrativeDictionarySchema, type NarrativeDictionary } from '../schema/narrative.ts';

import manifest010 from '../../packs/0.1.0/manifest.json' with { type: 'json' };
import eventCon001 from '../../packs/0.1.0/events/EVT-CON-001.json' with { type: 'json' };
import eventCon002 from '../../packs/0.1.0/events/EVT-CON-002.json' with { type: 'json' };
import eventCon003 from '../../packs/0.1.0/events/EVT-CON-003.json' with { type: 'json' };
import eventDev001 from '../../packs/0.1.0/events/EVT-DEV-001.json' with { type: 'json' };
import eventDev002 from '../../packs/0.1.0/events/EVT-DEV-002.json' with { type: 'json' };
import eventInj001 from '../../packs/0.1.0/events/EVT-INJ-001.json' with { type: 'json' };
import eventMedia001 from '../../packs/0.1.0/events/EVT-MEDIA-001.json' with { type: 'json' };
import eventMgr001 from '../../packs/0.1.0/events/EVT-MGR-001.json' with { type: 'json' };
import eventNat001 from '../../packs/0.1.0/events/EVT-NAT-001.json' with { type: 'json' };
import eventRel001 from '../../packs/0.1.0/events/EVT-REL-001.json' with { type: 'json' };
import eventRel002 from '../../packs/0.1.0/events/EVT-REL-002.json' with { type: 'json' };
import chapterMatch001 from '../../packs/0.1.0/chapters/CHP-MATCH-001.json' with { type: 'json' };
import chapterMatch002 from '../../packs/0.1.0/chapters/CHP-MATCH-002.json' with { type: 'json' };
import chapterMatch004 from '../../packs/0.1.0/chapters/CHP-MATCH-004.json' with { type: 'json' };
import chapterNat001 from '../../packs/0.1.0/chapters/CHP-NAT-001.json' with { type: 'json' };
import narrativeTokens010 from '../../packs/0.1.0/narrative/tokens.json' with { type: 'json' };

import manifest020 from '../../packs/0.2.0/manifest.json' with { type: 'json' };
import eventCon001v020 from '../../packs/0.2.0/events/EVT-CON-001.json' with { type: 'json' };
import eventCon002v020 from '../../packs/0.2.0/events/EVT-CON-002.json' with { type: 'json' };
import eventCon003v020 from '../../packs/0.2.0/events/EVT-CON-003.json' with { type: 'json' };
import eventCon010 from '../../packs/0.2.0/events/EVT-CON-010.json' with { type: 'json' };
import eventCon011 from '../../packs/0.2.0/events/EVT-CON-011.json' with { type: 'json' };
import eventCon012 from '../../packs/0.2.0/events/EVT-CON-012.json' with { type: 'json' };
import eventCon013 from '../../packs/0.2.0/events/EVT-CON-013.json' with { type: 'json' };
import eventDev001v020 from '../../packs/0.2.0/events/EVT-DEV-001.json' with { type: 'json' };
import eventDev002v020 from '../../packs/0.2.0/events/EVT-DEV-002.json' with { type: 'json' };
import eventInj001v020 from '../../packs/0.2.0/events/EVT-INJ-001.json' with { type: 'json' };
import eventMedia001v020 from '../../packs/0.2.0/events/EVT-MEDIA-001.json' with { type: 'json' };
import eventMedia006 from '../../packs/0.2.0/events/EVT-MEDIA-006.json' with { type: 'json' };
import eventMgr001v020 from '../../packs/0.2.0/events/EVT-MGR-001.json' with { type: 'json' };
import eventNat001v020 from '../../packs/0.2.0/events/EVT-NAT-001.json' with { type: 'json' };
import eventRel001v020 from '../../packs/0.2.0/events/EVT-REL-001.json' with { type: 'json' };
import eventRel002v020 from '../../packs/0.2.0/events/EVT-REL-002.json' with { type: 'json' };
import eventRel010 from '../../packs/0.2.0/events/EVT-REL-010.json' with { type: 'json' };
import eventEth010 from '../../packs/0.2.0/events/EVT-ETH-010.json' with { type: 'json' };
import eventMedia010 from '../../packs/0.2.0/events/EVT-MEDIA-010.json' with { type: 'json' };
import eventSlump010 from '../../packs/0.2.0/events/EVT-SLUMP-010.json' with { type: 'json' };
import chapterMatch001v020 from '../../packs/0.2.0/chapters/CHP-MATCH-001.json' with { type: 'json' };
import chapterMatch002v020 from '../../packs/0.2.0/chapters/CHP-MATCH-002.json' with { type: 'json' };
import chapterMatch004v020 from '../../packs/0.2.0/chapters/CHP-MATCH-004.json' with { type: 'json' };
import chapterNat001v020 from '../../packs/0.2.0/chapters/CHP-NAT-001.json' with { type: 'json' };
import narrativeTokens020 from '../../packs/0.2.0/narrative/tokens.json' with { type: 'json' };

export const PACK_VERSIONS = ['0.1.0', '0.2.0'] as const;
export type PackVersion = (typeof PACK_VERSIONS)[number];

export type ContentPack = {
  manifest: PackManifest;
  events: readonly EventDefinition[];
  eventsById: ReadonlyMap<string, EventDefinition>;
  chapters: readonly ChapterDefinition[];
  chaptersById: ReadonlyMap<string, ChapterDefinition>;
  narrativeTokens: NarrativeDictionary;
};

type PackSource = { manifest: unknown; events: readonly unknown[]; chapters: readonly unknown[]; narrativeTokens: unknown };

const PACK_SOURCES: Record<PackVersion, PackSource> = {
  '0.1.0': {
    manifest: manifest010,
    events: [
      eventCon001,
      eventCon002,
      eventCon003,
      eventDev001,
      eventDev002,
      eventInj001,
      eventMedia001,
      eventMgr001,
      eventNat001,
      eventRel001,
      eventRel002,
    ],
    chapters: [chapterMatch001, chapterMatch002, chapterMatch004, chapterNat001],
    narrativeTokens: narrativeTokens010,
  },
  '0.2.0': {
    manifest: manifest020,
    events: [
      eventCon001v020,
      eventCon002v020,
      eventCon003v020,
      eventCon010,
      eventCon011,
      eventCon012,
      eventCon013,
      eventDev001v020,
      eventDev002v020,
      eventInj001v020,
      eventMedia001v020,
      eventMedia006,
      eventMgr001v020,
      eventRel001v020,
      eventRel002v020,
      eventRel010,
      eventEth010,
      eventMedia010,
      eventSlump010,
      eventNat001v020,
    ],
    chapters: [chapterMatch001v020, chapterMatch002v020, chapterMatch004v020, chapterNat001v020],
    narrativeTokens: narrativeTokens020,
  },
};

/**
 * 번들에 포함된 팩 JSON(manifest·이벤트 11개·챕터 4개·narrative 사전)을 스키마로 검증해 동기로
 * 돌려준다. `loadRuleset`과 같은 방식(정적 JSON import)이라 Node `fs` 없이 브라우저에서도 쓸 수
 * 있다. CLI 전용 `cli/load-pack.ts`(디렉터리를 `readdirSync`로 스캔)와는 별개다.
 */
export function loadContentPack(version: string): ContentPack {
  if (!(PACK_VERSIONS as readonly string[]).includes(version)) {
    throw new Error(`알 수 없는 contentPackVersion: ${version}`);
  }
  const source = PACK_SOURCES[version as PackVersion];

  const manifest = PackManifestSchema.parse(source.manifest);
  const events = source.events.map((raw) => EventDefinitionSchema.parse(raw));
  const chapters = source.chapters.map((raw) => ChapterDefinitionSchema.parse(raw));
  const narrativeTokens = NarrativeDictionarySchema.parse(source.narrativeTokens);
  const eventsById = new Map(events.map((event) => [event.id, event]));
  const chaptersById = new Map(chapters.map((chapter) => [chapter.id, chapter]));

  return { manifest, events, eventsById, chapters, chaptersById, narrativeTokens };
}
