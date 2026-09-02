import { describe, expect, it } from 'vitest';
import { loadContentPack } from './load-content-pack.ts';

describe('loadContentPack', () => {
  it('0.1.0의 이벤트 개수가 10개이고 manifest.files의 events 목록과 id가 일치한다', () => {
    const pack = loadContentPack('0.1.0');
    expect(pack.events).toHaveLength(10);

    const idsFromManifest = pack.manifest.files
      .filter((file) => file.startsWith('events/'))
      .map((file) => file.replace('events/', '').replace('.json', ''))
      .sort();
    const idsFromEvents = pack.events.map((event) => event.id).sort();
    expect(idsFromEvents).toEqual(idsFromManifest);
  });

  it('eventsById가 모든 이벤트를 id로 조회할 수 있다', () => {
    const pack = loadContentPack('0.1.0');
    for (const event of pack.events) {
      expect(pack.eventsById.get(event.id)).toBe(event);
    }
  });

  it('알 수 없는 버전은 throw한다', () => {
    expect(() => loadContentPack('9.9.9')).toThrow();
  });
});
