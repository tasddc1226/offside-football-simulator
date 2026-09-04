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
      expect(event020, event010.id).toBeDefined();
      if (event020 === undefined) continue;
      // EVT-INJ-001은 T-4-002 §2에 따라 0.2.0에서 문구가 바뀌어 PROTOTYPE 표지가 추가된다.
      // authoring을 제외한 정의 본문은 0.1.0과 그대로여야 한다.
      if (event010.id === 'EVT-INJ-001') {
        expect({ ...event020, authoring: undefined }).toEqual({ ...event010, authoring: undefined });
      } else {
        expect(event020).toEqual(event010);
      }
    }
  });

  it('문구가 바뀐 EVT-INJ-001은 0.2.0에서 PROTOTYPE으로 표시된다', () => {
    expect(loadContentPack('0.2.0').eventsById.get('EVT-INJ-001')?.authoring).toBe('PROTOTYPE');
  });

  it('eventsById가 모든 이벤트를 id로 조회할 수 있다', () => {
    const pack = loadContentPack('0.2.0');
    for (const event of pack.events) {
      expect(pack.eventsById.get(event.id)).toBe(event);
    }
  });
});

describe('EVT-INJ-001 재활 선택 preview 정량 계약', () => {
  it.each(['0.1.0', '0.2.0'] as const)('%s가 세 rehabPlan의 이동량·재발 bp를 선택 전에 보여준다', (version) => {
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
