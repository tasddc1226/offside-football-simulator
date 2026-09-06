import { describe, expect, it } from 'vitest';
import { loadContentPack } from '../../src/packs/load-content-pack.ts';

describe('packs/0.5.0 게임성 QA', () => {
  const pack = loadContentPack('0.5.0');

  it('새 페어의 배경별 첫 PATH 사건을 등록한다', () => {
    expect(pack.manifest.compatibleRulesetVersions).toEqual(['1.3.0']);
    expect(['EVT-CON-020', 'EVT-CON-021', 'EVT-CON-022'].every((id) => pack.eventsById.has(id))).toBe(true);
  });

  it('골키퍼 공통 사건은 공격수·포지션 전환을 전제하지 않는다', () => {
    for (const eventId of ['EVT-CON-003', 'EVT-DEV-002', 'EVT-MGR-001']) {
      const event = pack.eventsById.get(eventId);
      expect(JSON.stringify(event), eventId).not.toMatch(/윙어|포지션 전환|무득점|무도움|결정력|무리한 슛/);
      expect(event?.choices.flatMap((choice) => choice.outcomes).flatMap((outcome) => outcome.effects))
        .not.toEqual(expect.arrayContaining([expect.objectContaining({ target: 'positionProficiency' })]));
    }
  });
});
