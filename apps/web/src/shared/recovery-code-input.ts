// SCR-030 "프로필 복구" 입력 필드의 형식 검사. 컴포넌트에서 분리해 단위 테스트한다(브리프 10번).
import { RecoveryCodeInputSchema } from '@offside/contracts';

export type RecoveryCodeValidation = { ok: true; normalized: string } | { ok: false; message: string };

const FORMAT_ERROR_MESSAGE =
  '복구 코드 형식이 올바르지 않습니다. OFS-XXXX-XXXX-XXXX 꼴로 입력하세요(공백·소문자 가능, I·L·O·U·0·1 제외).';

/** 형식이 맞으면 정규화된 12자 코드를, 아니면 필드 옆에 보여줄 오류 문장을 돌려준다. */
export function validateRecoveryCodeInput(raw: string): RecoveryCodeValidation {
  const parsed = RecoveryCodeInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: FORMAT_ERROR_MESSAGE };
  }
  return { ok: true, normalized: parsed.data };
}
