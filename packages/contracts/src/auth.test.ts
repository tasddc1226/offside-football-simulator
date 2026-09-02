import { describe, expect, it } from 'vitest';
import {
  DeleteProfileConfirmBodySchema,
  DeleteProfileStartResponseSchema,
  formatRecoveryCode,
  IssueRecoveryCodeResponseSchema,
  MergeChoiceSchema,
  normalizeRecoveryCode,
  RECOVERY_CODE_ALPHABET,
  RecoverProfileBodySchema,
  RecoverProfileResponseSchema,
  RecoveryCodeInputSchema,
  RecoveryConflictDetailsSchema,
} from './auth.js';

describe('RECOVERY_CODE_ALPHABET', () => {
  it('30자, I L O U 0 1을 포함하지 않는다', () => {
    expect(RECOVERY_CODE_ALPHABET.length).toBe(30);
    for (const excluded of ['I', 'L', 'O', 'U', '0', '1']) {
      expect(RECOVERY_CODE_ALPHABET.includes(excluded)).toBe(false);
    }
  });
});

describe('normalizeRecoveryCode', () => {
  it("'ofs-abcd 2345-efgh' → 'ABCD2345EFGH'", () => {
    expect(normalizeRecoveryCode('ofs-abcd 2345-efgh')).toBe('ABCD2345EFGH');
  });

  it('OFS 접두가 없으면 그대로(대문자화만) 둔다', () => {
    expect(normalizeRecoveryCode('abcd-2345-efgh')).toBe('ABCD2345EFGH');
  });
});

describe('formatRecoveryCode', () => {
  it('12자를 OFS-XXXX-XXXX-XXXX로 되돌린다', () => {
    expect(formatRecoveryCode('ABCD2345EFGH')).toBe('OFS-ABCD-2345-EFGH');
  });

  it('normalize ↔ format 왕복', () => {
    const display = 'OFS-ABCD-2345-EFGH';
    expect(formatRecoveryCode(normalizeRecoveryCode(display))).toBe(display);
  });

  it('12자가 아니면 throw한다', () => {
    expect(() => formatRecoveryCode('ABCD2345')).toThrow(RangeError);
  });
});

describe('RecoveryCodeInputSchema', () => {
  it('여러 표기 변형을 정규화해 12자 코드로 파싱한다', () => {
    const result = RecoveryCodeInputSchema.safeParse('ofs-abcd 2345-efgh');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('ABCD2345EFGH');
    }
  });

  it.each(['I', 'L', 'O', 'U', '0', '1'])('알파벳에 없는 문자 %s가 섞이면 거부한다', (bad) => {
    const code = `ABCD234${bad}EFGH`; // 12자 유지, 알파벳 밖 문자 하나 포함
    expect(RecoveryCodeInputSchema.safeParse(code).success).toBe(false);
  });

  it('정규화 후 길이가 12자가 아니면 거부한다', () => {
    expect(RecoveryCodeInputSchema.safeParse('OFS-ABCD-2345').success).toBe(false);
  });
});

describe('나머지 스키마 스모크', () => {
  it('IssueRecoveryCodeResponseSchema', () => {
    const result = IssueRecoveryCodeResponseSchema.safeParse({
      code: 'OFS-ABCD-2345-EFGH',
      issuedAt: '2026-09-02T00:00:00Z',
    });
    expect(result.success).toBe(true);
  });

  it('IssueRecoveryCodeResponseSchema는 표시형이 아닌 code를 거부한다', () => {
    const result = IssueRecoveryCodeResponseSchema.safeParse({
      code: 'ABCD2345EFGH',
      issuedAt: '2026-09-02T00:00:00Z',
    });
    expect(result.success).toBe(false);
  });

  it('MergeChoiceSchema', () => {
    expect(MergeChoiceSchema.safeParse('MOVE_TO_LINKED').success).toBe(true);
    expect(MergeChoiceSchema.safeParse('DELETE').success).toBe(false);
  });

  it('RecoverProfileBodySchema는 mergeChoice 없이도 성공한다', () => {
    const result = RecoverProfileBodySchema.safeParse({ code: 'OFS-ABCD-2345-EFGH' });
    expect(result.success).toBe(true);
  });

  it('RecoverProfileResponseSchema', () => {
    expect(RecoverProfileResponseSchema.safeParse({ profileId: 'prof_1', careerCount: 2 }).success).toBe(true);
    expect(RecoverProfileResponseSchema.safeParse({ profileId: 'prof_1', careerCount: -1 }).success).toBe(false);
  });

  it('RecoveryConflictDetailsSchema', () => {
    const result = RecoveryConflictDetailsSchema.safeParse({ currentCareerCount: 1, targetCareerCount: 0 });
    expect(result.success).toBe(true);
  });

  it('DeleteProfileStartResponseSchema', () => {
    const result = DeleteProfileStartResponseSchema.safeParse({
      confirmToken: 'tok_1',
      expiresAt: '2026-09-02T00:10:00Z',
    });
    expect(result.success).toBe(true);
  });

  it('DeleteProfileConfirmBodySchema', () => {
    expect(DeleteProfileConfirmBodySchema.safeParse({ confirmToken: 'tok_1' }).success).toBe(true);
    expect(DeleteProfileConfirmBodySchema.safeParse({}).success).toBe(false);
  });
});
