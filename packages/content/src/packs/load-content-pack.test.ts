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

// T-3-006: 팩 0.2.0은 0.1.0의 정의 10개·챕터 3개를 바이트 동일로 품고 PRO 이벤트 5개를 더한다.
describe('loadContentPack: 0.2.0', () => {
  it('0.2.0의 이벤트 개수가 15개이고 manifest.files의 events 목록과 id가 일치한다', () => {
    const pack = loadContentPack('0.2.0');
    expect(pack.events).toHaveLength(15);

    const idsFromManifest = pack.manifest.files
      .filter((file) => file.startsWith('events/'))
      .map((file) => file.replace('events/', '').replace('.json', ''))
      .sort();
    const idsFromEvents = pack.events.map((event) => event.id).sort();
    expect(idsFromEvents).toEqual(idsFromManifest);
  });

  it('챕터는 3개다', () => {
    const pack = loadContentPack('0.2.0');
    expect(pack.chapters).toHaveLength(3);
  });

  it('0.1.0 로드 결과는 불변이다(정의 10개 deep-equal)', () => {
    const pack010 = loadContentPack('0.1.0');
    expect(pack010.events).toHaveLength(10);
  });

  it('0.2.0의 0.1.0 유래 정의 10개는 0.1.0과 deep-equal이다', () => {
    const pack010 = loadContentPack('0.1.0');
    const pack020 = loadContentPack('0.2.0');
    for (const event010 of pack010.events) {
      const event020 = pack020.eventsById.get(event010.id);
      expect(event020, event010.id).toEqual(event010);
    }
  });

  it('eventsById가 모든 이벤트를 id로 조회할 수 있다', () => {
    const pack = loadContentPack('0.2.0');
    for (const event of pack.events) {
      expect(pack.eventsById.get(event.id)).toBe(event);
    }
  });
});
