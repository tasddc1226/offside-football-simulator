import { describe, expect, it } from 'vitest';
import { loadContentPack } from './load-content-pack.ts';

describe('loadContentPack', () => {
  it('0.1.0의 이벤트 개수가 11개이고 manifest.files의 events 목록과 id가 일치한다', () => {
    const pack = loadContentPack('0.1.0');
    expect(pack.events).toHaveLength(11);

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

// T-3-006/T-4-003/T-4-004: 팩 0.2.0은 0.1.0의 정의와 대표팀 정의를 품고 prototype 문구를 더한다.
describe('loadContentPack: 0.2.0', () => {
  it('0.2.0의 이벤트 개수가 20개이고 manifest.files의 events 목록과 id가 일치한다', () => {
    const pack = loadContentPack('0.2.0');
    expect(pack.events).toHaveLength(20);

    const idsFromManifest = pack.manifest.files
      .filter((file) => file.startsWith('events/'))
      .map((file) => file.replace('events/', '').replace('.json', ''))
      .sort();
    const idsFromEvents = pack.events.map((event) => event.id).sort();
    expect(idsFromEvents).toEqual(idsFromManifest);
  });

  it('챕터는 4개다', () => {
    const pack = loadContentPack('0.2.0');
    expect(pack.chapters).toHaveLength(4);
  });

  it('0.1.0 로드 결과는 불변이다(정의 11개 deep-equal)', () => {
    const pack010 = loadContentPack('0.1.0');
    expect(pack010.events).toHaveLength(11);
  });

  it('0.2.0의 0.1.0 유래 정의는 0.1.0과 deep-equal이다', () => {
    const pack010 = loadContentPack('0.1.0');
    const pack020 = loadContentPack('0.2.0');
    for (const event010 of pack010.events) {
      const event020 = pack020.eventsById.get(event010.id);
      expect(event020, event010.id).toBeDefined();
      if (event020 === undefined) continue;
      // EVT-INJ-001·EVT-NAT-001은 각 티켓의 prototype 문구 표지가 0.2.0에 추가된다.
      // authoring을 제외한 정의 본문은 0.1.0과 그대로여야 한다.
      if (event010.id === 'EVT-INJ-001' || event010.id === 'EVT-NAT-001') {
        expect({ ...event020, authoring: undefined }).toEqual({ ...event010, authoring: undefined });
      } else {
        expect(event020).toEqual(event010);
      }
    }
  });

  it('대표팀·부상 prototype 정의는 0.2.0에서 PROTOTYPE으로 표시된다', () => {
    expect(loadContentPack('0.2.0').eventsById.get('EVT-INJ-001')?.authoring).toBe('PROTOTYPE');
    expect(loadContentPack('0.2.0').eventsById.get('EVT-NAT-001')?.authoring).toBe('PROTOTYPE');
  });

  it('eventsById가 모든 이벤트를 id로 조회할 수 있다', () => {
    const pack = loadContentPack('0.2.0');
    for (const event of pack.events) {
      expect(pack.eventsById.get(event.id)).toBe(event);
    }
  });
});

// T-4-008: 팩 0.3.0은 0.2.0 전체(이벤트 20·챕터 4)를 바이트 동일하게 품고, Phase 4 카탈로그
// 후보 12개와 포지션 전용 챕터 3개를 더한다.
describe('loadContentPack: 0.3.0', () => {
  it('0.3.0의 이벤트 개수가 32개이고 manifest.files의 events 목록과 id가 일치한다', () => {
    const pack = loadContentPack('0.3.0');
    expect(pack.events).toHaveLength(32);

    const idsFromManifest = pack.manifest.files
      .filter((file) => file.startsWith('events/'))
      .map((file) => file.replace('events/', '').replace('.json', ''))
      .sort();
    const idsFromEvents = pack.events.map((event) => event.id).sort();
    expect(idsFromEvents).toEqual(idsFromManifest);
  });

  it('챕터는 7개다', () => {
    const pack = loadContentPack('0.3.0');
    expect(pack.chapters).toHaveLength(7);
  });

  it('0.2.0 로드 결과는 불변이다(정의 20개 deep-equal, 챕터 4개)', () => {
    const pack020 = loadContentPack('0.2.0');
    expect(pack020.events).toHaveLength(20);
    expect(pack020.chapters).toHaveLength(4);
  });

  it('0.3.0의 0.2.0 유래 이벤트 정의 20개는 0.2.0과 deep-equal이다', () => {
    const pack020 = loadContentPack('0.2.0');
    const pack030 = loadContentPack('0.3.0');
    for (const event020 of pack020.events) {
      const event030 = pack030.eventsById.get(event020.id);
      expect(event030, event020.id).toEqual(event020);
    }
  });

  it('0.3.0의 0.2.0 유래 챕터 정의 4개는 0.2.0과 deep-equal이다', () => {
    const pack020 = loadContentPack('0.2.0');
    const pack030 = loadContentPack('0.3.0');
    for (const chapter020 of pack020.chapters) {
      const chapter030 = pack030.chaptersById.get(chapter020.id);
      expect(chapter030, chapter020.id).toEqual(chapter020);
    }
  });

  it('eventsById·chaptersById가 모든 정의를 id로 조회할 수 있다', () => {
    const pack = loadContentPack('0.3.0');
    for (const event of pack.events) {
      expect(pack.eventsById.get(event.id)).toBe(event);
    }
    for (const chapter of pack.chapters) {
      expect(pack.chaptersById.get(chapter.id)).toBe(chapter);
    }
  });
});

describe('EVT-INJ-001 재활 선택 preview 정량 계약', () => {
  it.each(['0.1.0', '0.2.0', '0.3.0'] as const)('%s가 세 rehabPlan의 이동량·재발 bp를 선택 전에 보여준다', (version) => {
    const event = loadContentPack(version).eventsById.get('EVT-INJ-001');
    expect(event).toBeDefined();
    const previews = Object.fromEntries(
      event!.choices.map((choice) => [choice.rehabPlan, choice.previewEffects.map((effect) => effect.label)]),
    );
    expect(previews).toEqual({
      STANDARD: ['복귀 경기 범위 이동: 0경기 (중간값)', '재발 위험: 0bp 변화', '출전 기회: 중간 수준 상실'],
      EARLY: ['복귀 경기 범위 이동: -2경기 (최소값)', '재발 위험: +1500bp', '출전 기회: 가장 적게 상실'],
      CONSERVATIVE: ['복귀 경기 범위 이동: +2경기 (최대값)', '재발 위험: -1000bp', '출전 기회: 가장 많이 상실'],
    });
  });
});

describe('loadContentPack: 0.5.0', () => {
  it('manifest의 정의를 모두 등록하고 이전 팩은 그대로 보존한다', () => {
    const previous = loadContentPack('0.4.1');
    const pack = loadContentPack('0.5.0');
    const manifestIds = (prefix: 'events/' | 'chapters/') =>
      pack.manifest.files
        .filter((file) => file.startsWith(prefix))
        .map((file) => file.slice(prefix.length, -'.json'.length))
        .sort();

    expect(pack.events.map((event) => event.id).sort()).toEqual(manifestIds('events/'));
    expect(pack.chapters.map((chapter) => chapter.id).sort()).toEqual(manifestIds('chapters/'));
    expect(previous.manifest.contentPackVersion).toBe('0.4.1');
    // T-7-001 D-67: 팩 0.5.0은 룰셋 1.4.0과도 호환된다(이벤트·챕터 checksum은 파일 목록 대상이라 불변).
    expect(pack.manifest.compatibleRulesetVersions).toEqual(['1.3.0', '1.4.0']);
  });
});
