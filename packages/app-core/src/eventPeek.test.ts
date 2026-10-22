import { afterEach, describe, expect, it } from 'vitest';
import { EVENT_PEEK } from '@offside/game/event-peek-data';
import { en } from './i18n/en/index.js';
import { setLocale } from './i18n/core.js';
import { choiceChips, choiceChipsFor, peekText } from './eventPeek';

describe('이벤트 선택지 득실 칩 (T-11-432)', () => {
  afterEach(() => setLocale('ko'));

  it('득실 키를 칩 글자로 옮긴다', () => {
    expect(peekText('cond-')).toBe('컨디션 ↓');
    expect(peekText('trust+')).toBe('신뢰 ↑');
    expect(peekText('out')).toBe('결장');
    expect(peekText('story:scandal')).toBe('스캔들 시작');
    expect(peekText('nope+')).toBeNull();
    expect(peekText('story:nope')).toBeNull();
  });

  it('판정 없는 선택지는 손해를 먼저, 이득을 하나 더 보인다', () => {
    // 광고 모델 제의 · 계약: 인기는 오르지만 컨디션이 깎인다.
    expect(choiceChipsFor('ad', 0, 'sure')).toEqual([
      { text: '컨디션 ↓', tone: 'down' },
      { text: '인기 ↑', tone: 'up' },
    ]);
    expect(choiceChips({ ok: ['fame+', 'morale+', 'trust+'] }, 'sure')).toHaveLength(2);
  });

  it('판정 선택지는 성공 이득 하나와 실패 손해 하나를 보인다', () => {
    // 파티: 실패하면 스캔들이 시작된다.
    const chips = choiceChipsFor('party', 0, 'roll');
    expect(chips[0]!.tone).toBe('up');
    expect(chips[1]).toEqual({ text: '실패 시 스캔들 시작', tone: 'down' });
  });

  it('안전한 선택은 가끔 붙는 대가를 함께 알린다', () => {
    expect(choiceChips({ ok: ['morale+'] }, 'safe')).toEqual([
      { text: '사기 ↑', tone: 'up' },
      { text: '가끔 대가', tone: 'risk' },
    ]);
    // 감독실 노크 · 묵묵히 훈련: 능력치는 오르지만 컨디션이 깎이고, 가끔 대가가 붙는다.
    expect(choiceChipsFor('bench-talk', 1, 'safe').map((c) => c.text)).toEqual([
      '컨디션 ↓',
      '능력치 ↑',
      '가끔 대가',
    ]);
  });

  it('데이터가 없으면 칩도 없다(화면은 hint를 보인다)', () => {
    expect(choiceChips(undefined, 'sure')).toEqual([]);
    expect(choiceChips(undefined, 'roll')).toEqual([]);
  });

  it('생성된 모든 득실 키를 칩 글자로 옮길 수 있다', () => {
    for (const [id, list] of Object.entries(EVENT_PEEK))
      for (const p of list)
        for (const k of [...(p.ok ?? []), ...(p.fail ?? [])])
          expect(peekText(k), `${id} ${k}`).not.toBeNull();
  });

  it('영어로도 옮긴다', () => {
    setLocale('en', en);
    expect(peekText('cond-')).toBe('Condition ↓');
    expect(choiceChips({ fail: ['morale-'] }, 'roll')).toEqual([
      { text: 'If it fails: Morale ↓', tone: 'down' },
    ]);
  });
});
