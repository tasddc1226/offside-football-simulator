import { z } from 'zod';
import { IsoUtcSchema } from './primitives.js';

/**
 * D-14: 복구 코드 알파벳. Crockford base32에서 `I L O U 0 1`을 뺀 26자 중 문자 22자 + 숫자
 * `2`~`9` 8자, 총 30자(약 2^59, 12자리). `apps/api`의 생성기(T-1-004)와 값이 같아야 한다.
 */
export const RECOVERY_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';

const RECOVERY_CODE_ALPHABET_SET = new Set(RECOVERY_CODE_ALPHABET);

function isRecoveryCodeAlphabet(value: string): boolean {
  for (const char of value) {
    if (!RECOVERY_CODE_ALPHABET_SET.has(char)) return false;
  }
  return true;
}

/** 대문자화 → 공백·하이픈 제거 → 앞의 `OFS` 접두 제거. `apps/api`의 `normalize`와 같은 규칙(D-14). */
export function normalizeRecoveryCode(input: string): string {
  const upper = input.toUpperCase();
  const stripped = upper.replace(/[\s-]/g, '');
  return stripped.startsWith('OFS') ? stripped.slice(3) : stripped;
}

/** 정규화된 12자 코드를 표시형 `OFS-XXXX-XXXX-XXXX`로 되돌린다. */
export function formatRecoveryCode(normalized: string): string {
  if (normalized.length !== 12) {
    throw new RangeError(`formatRecoveryCode: 정규화된 코드는 12자여야 한다. 받은 길이: ${normalized.length}`);
  }
  return `OFS-${normalized.slice(0, 4)}-${normalized.slice(4, 8)}-${normalized.slice(8, 12)}`;
}

const RECOVERY_CODE_DISPLAY_PATTERN = new RegExp(
  `^OFS-[${RECOVERY_CODE_ALPHABET}]{4}-[${RECOVERY_CODE_ALPHABET}]{4}-[${RECOVERY_CODE_ALPHABET}]{4}$`,
);

/**
 * 사용자가 입력한 형태(대소문자·공백·하이픈·`ofs` 접두 유무 무관)를 받아 정규화하고, 12자·알파벳을
 * 검사한다. 파싱 결과는 정규화된 코드 문자열이다(`API-PRO-004` 요청 본문이 그대로 저장소 조회에 쓴다).
 */
export const RecoveryCodeInputSchema = z.string().transform((value, ctx) => {
  const normalized = normalizeRecoveryCode(value);
  if (normalized.length !== 12 || !isRecoveryCodeAlphabet(normalized)) {
    ctx.addIssue({
      code: 'custom',
      message: '복구 코드는 OFS-XXXX-XXXX-XXXX 형식(I L O U 0 1 제외)이어야 한다.',
    });
    return z.NEVER;
  }
  return normalized;
});

export const MergeChoiceSchema = z.enum(['MOVE_TO_LINKED', 'KEEP_LINKED_ONLY']);
export type MergeChoice = z.infer<typeof MergeChoiceSchema>;

/** API-PRO-003 응답. 원문 코드는 발급 응답에 한 번만 담긴다(D-14). */
export const IssueRecoveryCodeResponseSchema = z.strictObject({
  code: z.string().regex(RECOVERY_CODE_DISPLAY_PATTERN, 'OFS-XXXX-XXXX-XXXX 형식이어야 한다.'),
  issuedAt: IsoUtcSchema,
});
export type IssueRecoveryCodeResponse = z.infer<typeof IssueRecoveryCodeResponseSchema>;

/** API-PRO-004 요청 본문. `mergeChoice` 없이 충돌하면 409 `RECOVERY_CONFLICT`. */
export const RecoverProfileBodySchema = z.strictObject({
  code: RecoveryCodeInputSchema,
  mergeChoice: MergeChoiceSchema.optional(),
});
export type RecoverProfileBody = z.infer<typeof RecoverProfileBodySchema>;

export const RecoverProfileResponseSchema = z.strictObject({
  profileId: z.string().min(1),
  careerCount: z.number().int().nonnegative(),
});
export type RecoverProfileResponse = z.infer<typeof RecoverProfileResponseSchema>;

/** 409 `RECOVERY_CONFLICT` 오류의 `details`(D-14). */
export const RecoveryConflictDetailsSchema = z.strictObject({
  currentCareerCount: z.number().int().nonnegative(),
  targetCareerCount: z.number().int().nonnegative(),
});
export type RecoveryConflictDetails = z.infer<typeof RecoveryConflictDetailsSchema>;

/** API-PRO-005 1단계(본문 없음) 응답. `confirmToken`은 10분 뒤 만료(D-15). */
export const DeleteProfileStartResponseSchema = z.strictObject({
  confirmToken: z.string().min(1),
  expiresAt: IsoUtcSchema,
});
export type DeleteProfileStartResponse = z.infer<typeof DeleteProfileStartResponseSchema>;

/** API-PRO-005 2단계 요청 본문. 성공하면 204(응답 스키마 없음). */
export const DeleteProfileConfirmBodySchema = z.strictObject({
  confirmToken: z.string().min(1),
});
export type DeleteProfileConfirmBody = z.infer<typeof DeleteProfileConfirmBodySchema>;

// POST /auth/logout(API-AUTH-004)과 DELETE /careers/{id}(API-CAR-005)는 요청 본문이 없고 응답이
// 204(본문 없음)라 이 파일에 스키마가 없다.
