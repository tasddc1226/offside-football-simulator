import { describe, expect, it } from 'vitest';
import { SHARE_EVENT, shareErrorKind, shareEventParams } from './shareMeasurement.js';

describe('T-11-668 공유 계측 계약', () => {
  it('클릭 · 미리보기 · 네이티브 성공 · 취소 · 복사 성공은 이름과 방법이 모두 다르다', () => {
    const rows = (['click', 'preview', 'native_success', 'cancel', 'copy_success'] as const).map(
      (kind) => shareEventParams({ kind }),
    );
    expect(rows.map((r) => [r.name, r.params.share_method])).toEqual([
      ['career_share_click', 'pending'],
      ['career_share_preview', 'native_share'],
      ['career_share_native_success', 'native_share'],
      ['career_share_cancel', 'native_share'],
      ['career_share_copy_success', 'copy_link'],
    ]);
    expect(new Set(Object.values(SHARE_EVENT)).size).toBe(Object.keys(SHARE_EVENT).length);
    for (const r of rows) expect(r.params.share_contract).toBe('2');
  });

  it('실패는 방법 · 단계 · 오류 종류만 보내고 원문은 보내지 않는다', () => {
    expect(
      shareEventParams({
        kind: 'failure',
        method: 'native_share',
        stage: 'native',
        error: 'not_allowed',
      }),
    ).toEqual({
      name: 'career_share_failure',
      params: {
        share_contract: '2',
        share_method: 'native_share',
        failure_stage: 'native',
        error_kind: 'not_allowed',
      },
    });
  });

  it('오류 이름을 고정 목록으로 줄인다', () => {
    expect(shareErrorKind(new DOMException('x', 'NotAllowedError'))).toBe('not_allowed');
    expect(shareErrorKind(new TypeError('bad'))).toBe('invalid_data');
    expect(shareErrorKind(new Error('네트워크 오류 원문'))).toBe('unknown');
    expect(shareErrorKind(null)).toBe('unknown');
    expect(shareErrorKind('x')).toBe('unknown');
  });
});
