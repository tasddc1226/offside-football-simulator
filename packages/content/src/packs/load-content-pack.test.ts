import { describe, expect, it } from 'vitest';
import { loadContentPack, PACK_VERSIONS } from './load-content-pack.ts';

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
        expect({ ...event020, authoring: undefined }).toEqual({
          ...event010,
          authoring: undefined,
        });
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
  it.each(['0.1.0', '0.2.0', '0.3.0'] as const)(
    '%s가 세 rehabPlan의 이동량·재발 bp를 선택 전에 보여준다',
    (version) => {
      const event = loadContentPack(version).eventsById.get('EVT-INJ-001');
      expect(event).toBeDefined();
      const previews = Object.fromEntries(
        event!.choices.map((choice) => [
          choice.rehabPlan,
          choice.previewEffects.map((effect) => effect.label),
        ]),
      );
      expect(previews).toEqual({
        STANDARD: [
          '복귀 경기 범위 이동: 0경기 (중간값)',
          '재발 위험: 0bp 변화',
          '출전 기회: 중간 수준 상실',
        ],
        EARLY: [
          '복귀 경기 범위 이동: -2경기 (최소값)',
          '재발 위험: +1500bp',
          '출전 기회: 가장 적게 상실',
        ],
        CONSERVATIVE: [
          '복귀 경기 범위 이동: +2경기 (최대값)',
          '재발 위험: -1000bp',
          '출전 기회: 가장 많이 상실',
        ],
      });
    },
  );
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
    const meetingPack = loadContentPack('0.6.1');
    expect(meetingPack.manifest.compatibleRulesetVersions).toEqual(['1.6.0']);
    expect(meetingPack.events.map((event) => event.id)).toEqual(
      loadContentPack('0.6.0').events.map((event) => event.id),
    );
    expect(meetingPack.chapters.map((chapter) => chapter.id)).toEqual(
      loadContentPack('0.6.0').chapters.map((chapter) => chapter.id),
    );
    // T-7-025: 팩 0.6.2는 0.6.1 전체 복사 + compatibleRulesetVersions만 룰셋 1.6.1로 교체(D-80 1라운드 ①).
    const peakAgePack = loadContentPack('0.6.2');
    expect(peakAgePack.manifest.compatibleRulesetVersions).toEqual(['1.6.1']);
    expect(peakAgePack.events.map((event) => event.id)).toEqual(
      loadContentPack('0.6.1').events.map((event) => event.id),
    );
    expect(peakAgePack.chapters.map((chapter) => chapter.id)).toEqual(
      loadContentPack('0.6.1').chapters.map((chapter) => chapter.id),
    );
    const ledgerPack = loadContentPack('0.6.3');
    expect(ledgerPack.manifest.compatibleRulesetVersions).toEqual(['1.7.0']);
    expect(ledgerPack.manifest.checksum).toBe(peakAgePack.manifest.checksum);
    expect(ledgerPack.events.map((event) => event.id)).toEqual(
      peakAgePack.events.map((event) => event.id),
    );
    expect(ledgerPack.chapters.map((chapter) => chapter.id)).toEqual(
      peakAgePack.chapters.map((chapter) => chapter.id),
    );
    const varietyPack = loadContentPack('0.6.4');
    expect(varietyPack.manifest.compatibleRulesetVersions).toEqual(['1.7.0']);
    const varietyManifestEventIds = varietyPack.manifest.files
      .filter((file) => file.startsWith('events/'))
      .map((file) => file.slice('events/'.length, -'.json'.length))
      .sort();
    expect(varietyPack.events.map((event) => event.id).sort()).toEqual(varietyManifestEventIds);
    for (const previousEvent of ledgerPack.events) {
      expect(varietyPack.eventsById.get(previousEvent.id)).toEqual(previousEvent);
    }
    expect(varietyPack.events.filter((event) => /-12[0-2]$/.test(event.id))).toHaveLength(18);
    const exposurePack = loadContentPack('0.6.5');
    expect(exposurePack.manifest.compatibleRulesetVersions).toEqual(['1.7.1']);
    expect(exposurePack.manifest.checksum).toBe(varietyPack.manifest.checksum);
    expect(exposurePack.events).toEqual(varietyPack.events);
    expect(exposurePack.chapters).toEqual(varietyPack.chapters);
    expect(exposurePack.narrativeTokens).toEqual(varietyPack.narrativeTokens);
    expect(loadContentPack('0.6.3').manifest.checksum).toBe(
      'b7eac78ecd9ea3e56baecc57017ba041f5b0fad428b9b0f3c918a0d1ca3a9f5f',
    );
  });
});

// T-7-036 D-89: 팩 0.6.6은 0.6.5 전체 복사 + EVT-REL-001·EVT-DEV-002 트리거에만 `contract.kind`
// 존재 가드를 추가한다(계약 없음 구간에서 우연히 걸리던 일반 사건을 막는다 — 시즌 중 조건은 그대로).
// compatibleRulesetVersions만 룰셋 1.7.2로 교체하고 나머지 정의는 바이트까지 그대로 보존한다.
//
// fix-precontract-whitelist: 위 T-7-036이 추가한 offerRules.preContract.bridgeEventIds가
// EVT-CON-020~028만 허용해도, EVT-CON-003(SCR-008 전용 입단 테스트 화면)은 그 화이트리스트와
// 무관하게 구조적으로 뜰 수 없었다 — EVT-CON-024~028(0.4.1부터 바이트 동일하게 재사용된 스카우트
// 평가 브리지)이 진로 태그(진로_입단테스트·진로_하부리그)와 EVT-CON-003의 exclusionTags(태그
// 입단테스트_완료)를 같은 outcome에서 함께 addTags해, 브리지가 해소되는 즉시 EVT-CON-003이 영구
// 제외됐다(0.6.5 이하·origin/main에도 같은 구조가 있어 재현되지만, 그 버전은 바이트 불변이라
// 고치지 않는다). 그래서 0.6.6에서만 이 다섯 이벤트도 갈라 입단테스트_완료 선주입을 제거했다
// (진로 태그·테스트_보통 힌트는 유지 — EVT-CON-003 자신이 해소되며 그 태그를 다시 붙인다).
describe('loadContentPack: 0.6.6', () => {
  it('EVT-REL-001·EVT-DEV-002·EVT-CON-024~028만 0.6.5와 다르고 나머지는 그대로다', () => {
    const previous = loadContentPack('0.6.5');
    const pack = loadContentPack('0.6.6');

    expect(pack.manifest.compatibleRulesetVersions).toEqual(['1.7.2']);
    expect(pack.manifest.checksum).not.toBe(previous.manifest.checksum);
    expect(pack.chapters).toEqual(previous.chapters);
    expect(pack.narrativeTokens).toEqual(previous.narrativeTokens);
    expect(pack.events.map((event) => event.id).sort()).toEqual(
      previous.events.map((event) => event.id).sort(),
    );

    const changedIds = new Set([
      'EVT-REL-001',
      'EVT-DEV-002',
      'EVT-CON-024',
      'EVT-CON-025',
      'EVT-CON-026',
      'EVT-CON-027',
      'EVT-CON-028',
    ]);
    for (const previousEvent of previous.events) {
      const nextEvent = pack.eventsById.get(previousEvent.id);
      if (changedIds.has(previousEvent.id)) {
        expect(nextEvent).not.toEqual(previousEvent);
      } else {
        expect(nextEvent).toEqual(previousEvent);
      }
    }

    expect(pack.eventsById.get('EVT-REL-001')?.triggers).toEqual({
      all: [
        { neq: ['contract.kind', ''] },
        { in: ['player.primaryPosition', ['W', 'AM', 'ST']] },
        { any: [{ hasTag: ['career.tags', '고집'] }, { gte: ['season.step', 4] }] },
      ],
    });
    expect(pack.eventsById.get('EVT-DEV-002')?.triggers).toEqual({
      all: [
        { neq: ['contract.kind', ''] },
        { lt: ['state.form', 45] },
        { gte: ['season.step', 5] },
      ],
    });

    // EVT-CON-024~028: 0.6.5와 트리거·choices 구조는 같고, 각 outcome의 addTags에서
    // `입단테스트_완료`만 빠졌다(진로 태그·테스트_보통 힌트는 그대로).
    for (const eventId of ['EVT-CON-024', 'EVT-CON-025', 'EVT-CON-026', 'EVT-CON-027', 'EVT-CON-028']) {
      const previousEvent = previous.eventsById.get(eventId)!;
      const nextEvent = pack.eventsById.get(eventId)!;
      expect(nextEvent.triggers).toEqual(previousEvent.triggers);
      expect(nextEvent.choices.map((choice) => choice.id)).toEqual(previousEvent.choices.map((choice) => choice.id));
      for (const previousChoice of previousEvent.choices) {
        const nextChoice = nextEvent.choices.find((choice) => choice.id === previousChoice.id)!;
        for (const previousOutcome of previousChoice.outcomes) {
          const nextOutcome = nextChoice.outcomes.find((outcome) => outcome.id === previousOutcome.id)!;
          expect(nextOutcome.addTags).toEqual(
            (previousOutcome.addTags ?? []).filter((tag) => tag !== '입단테스트_완료'),
          );
          expect(nextOutcome.effects).toEqual(previousOutcome.effects);
        }
      }
    }
  });
});

describe('loadContentPack: 0.6.7', () => {
  it('0.6.6 콘텐츠를 그대로 복사하고 1.7.3과만 호환된다', () => {
    const previous = loadContentPack('0.6.6');
    const pack = loadContentPack('0.6.7');

    expect(PACK_VERSIONS).toContain('0.6.7');
    expect(pack.manifest.contentPackVersion).toBe('0.6.7');
    expect(pack.manifest.compatibleRulesetVersions).toEqual(['1.7.3']);
    expect(pack.manifest.checksum).toBe(previous.manifest.checksum);
    expect(pack.events).toEqual(previous.events);
    expect(pack.chapters).toEqual(previous.chapters);
    expect(pack.narrativeTokens).toEqual(previous.narrativeTokens);
  });
});
