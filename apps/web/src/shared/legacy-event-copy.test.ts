import { loadContentPack } from '@offside/content';
import { describe, expect, it } from 'vitest';
import { eventOutcomeTitle, eventSituation } from './legacy-event-copy.js';

describe.each(['0.1.0', '0.2.0'])('구판 %s의 표시 문구 (#58, #59)', (version) => {
  const pack = loadContentPack(version);
  const path = pack.eventsById.get('EVT-CON-002')!;
  const tryout = pack.eventsById.get('EVT-CON-003')!;

  it('진로 문구에서 고정 정찰 값과 잘못된 선택지 수를 제거한다', () => {
    expect(eventSituation(path)).not.toMatch(/68~82|네 갈래|정찰 범위/);
    expect(eventSituation(path)).toContain('각 경로는 서로 다른 기회');
    expect(path.choices).toHaveLength(3);
  });

  it('입단 테스트의 작성용 수식 대신 서사를 표시한다', () => {
    expect(eventSituation(tryout)).toContain('입단 테스트');
    expect(eventSituation(tryout)).not.toMatch(/제안 수|화면 진입|태그|최대 3/);
  });

  it('두 진로의 결과에 내부 이벤트 ID가 없고 원본 콘텐츠는 변경되지 않는다', () => {
    const before = JSON.stringify(path);
    expect(eventOutcomeTitle(path, path.choices[0]!.outcomes[0]!)).toBe('프로 입단 테스트에 도전한다');
    expect(eventOutcomeTitle(path, path.choices[2]!.outcomes[0]!)).toBe('하부리그에서 첫 기회를 찾는다');
    eventSituation(path);
    expect(JSON.stringify(path)).toBe(before);
  });

  it('다른 이벤트·다음 버전·수정된 원문은 그대로 표시한다', () => {
    const other = { ...path, id: 'EVT-FUTURE-001' };
    const next = { ...path, version: 2 };
    const revised = { ...path, narrative: { ...path.narrative, situation: '새로운 진로 이야기' } };
    expect(eventSituation(other)).toBe(path.narrative.situation);
    expect(eventSituation(next)).toBe(path.narrative.situation);
    expect(eventSituation(revised)).toBe('새로운 진로 이야기');
    expect(eventOutcomeTitle(next, { title: 'EVT-P10 즉시 진행' })).toBe('EVT-P10 즉시 진행');
    expect(eventOutcomeTitle(other, { title: 'EVT-P10 즉시 진행' })).toBe('EVT-P10 즉시 진행');
    expect(eventOutcomeTitle(path, { title: '새로운 결과' })).toBe('새로운 결과');
  });
});
