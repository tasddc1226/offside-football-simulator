import { describe, expect, it } from 'vitest';
import { isOwnerTitle } from './owner-title.js';
import {
  XMAS_EVENT,
  XMAS_TARGET_RE,
  XMAS_TITLE,
  xmasInviteMult,
  xmasPhase,
  xmasTreeCounting,
  xmasTreePct,
} from './xmas-rules.js';

const at = (iso: string) => Date.parse(iso);

describe('T-11-834 크리스마스 이벤트 규칙', () => {
  it('12/19 00:00 KST에 열리고 1/5 00:00 KST에 닫힌다', () => {
    expect(xmasPhase(at('2026-12-18T14:59:59Z'))).toBe('before');
    expect(xmasPhase(at(XMAS_EVENT.startAt))).toBe('open');
    expect(xmasPhase(at('2027-01-04T14:59:59Z'))).toBe('open');
    expect(xmasPhase(at(XMAS_EVENT.endAt))).toBe('ended');
    expect(xmasPhase(at('2026-12-20T00:00:00Z'), true)).toBe('ended');
  });

  it('트리는 12/25까지 세고, 초대 2배는 이벤트 기간 내내', () => {
    expect(xmasTreeCounting(at('2026-12-25T14:59:59Z'))).toBe(true);
    expect(xmasTreeCounting(at(XMAS_EVENT.treeEndAt))).toBe(false);
    expect(xmasInviteMult(at('2027-01-01T00:00:00Z'))).toBe(2);
    expect(xmasInviteMult(at('2026-12-01T00:00:00Z'))).toBe(1);
    expect(XMAS_EVENT.treeDays).toHaveLength(7);
  });

  it('트리 진행도는 0~100 정수', () => {
    expect(xmasTreePct(0)).toBe(0);
    expect(xmasTreePct(2_999)).toBe(24);
    expect(xmasTreePct(3_000)).toBe(25);
    expect(xmasTreePct(99_999)).toBe(100);
  });

  it('받기 대상 · 한정 칭호 id', () => {
    for (const ok of ['sock:start', 'sock:retire', 'sock:team', 'tree:1', 'tree:4'])
      expect(XMAS_TARGET_RE.test(ok)).toBe(true);
    for (const bad of ['sock:x', 'tree:0', 'tree:5', 'sock:start '])
      expect(XMAS_TARGET_RE.test(bad)).toBe(false);
    expect(isOwnerTitle(XMAS_TITLE)).toBe(true);
    expect(isOwnerTitle('event-xmas-26')).toBe(false);
  });
});
