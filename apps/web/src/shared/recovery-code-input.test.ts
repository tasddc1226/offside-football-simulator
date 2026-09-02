import { describe, expect, it } from 'vitest';
import { validateRecoveryCodeInput } from './recovery-code-input.js';

describe('validateRecoveryCodeInput', () => {
  it('OFS-XXXX-XXXX-XXXX 형식 그대로면 정규화된 12자를 돌려준다', () => {
    const result = validateRecoveryCodeInput('OFS-ABCD-EFGH-JKMN');
    expect(result).toEqual({ ok: true, normalized: 'ABCDEFGHJKMN' });
  });

  it('소문자·공백·ofs 접두가 섞여도 받아들인다', () => {
    const result = validateRecoveryCodeInput('ofs abcd efgh jkmn');
    expect(result).toEqual({ ok: true, normalized: 'ABCDEFGHJKMN' });
  });

  it('길이가 모자라면 형식 오류를 돌려준다', () => {
    const result = validateRecoveryCodeInput('OFS-ABCD-EFGH');
    expect(result.ok).toBe(false);
  });

  it('알파벳에 없는 글자(0·1·I·L·O·U)가 있으면 형식 오류를 돌려준다', () => {
    const result = validateRecoveryCodeInput('OFS-0000-0000-0000');
    expect(result.ok).toBe(false);
  });

  it('빈 문자열은 형식 오류를 돌려준다', () => {
    const result = validateRecoveryCodeInput('');
    expect(result.ok).toBe(false);
  });
});
