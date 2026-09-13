import { describe, expect, it } from 'vitest';
import { loadContentPack } from '../../src/packs/load-content-pack.ts';

// D-77: 0.6.0 = 0.5.1 전체 복사 + narrative/tokens.json의 club·team 풀만 K리그식 27개 구단 이름으로
// 교체(룰셋 1.5.0과 짝). 이벤트·챕터는 0.5.1과 바이트 동일(팩은 불변 아티팩트, ADR-004) — narrative
// 사전만 다르다.
describe('packs/0.6.0 게임성 QA', () => {
  const previous = loadContentPack('0.5.1');
  const pack = loadContentPack('0.6.0');

  it('0.5.1의 이벤트·챕터를 그대로 품고 narrative만 다르다', () => {
    expect(pack.manifest.contentPackVersion).toBe('0.6.0');
    expect(pack.manifest.compatibleRulesetVersions).toEqual(['1.4.0', '1.5.0']);
    expect(pack.events.map((event) => event.id).sort()).toEqual(
      previous.events.map((event) => event.id).sort(),
    );
    for (const event of previous.events) {
      expect(pack.eventsById.get(event.id), event.id).toEqual(event);
    }
    for (const chapter of previous.chapters) {
      expect(pack.chaptersById.get(chapter.id), chapter.id).toEqual(chapter);
    }
    expect(pack.narrativeTokens).not.toEqual(previous.narrativeTokens);
    expect(pack.narrativeTokens.club).toContain('서울 한강 FC');
    expect(pack.narrativeTokens.club).not.toContain('한강 FC U21');
  });
});
