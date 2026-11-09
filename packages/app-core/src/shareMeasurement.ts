/**
 * T-11-668 커리어 공유 계측 계약(웹 · 앱 공용). 이벤트 이름 · share_method · 실패 단계를 한곳에 둔다.
 *
 * 한 번의 공유 시도(활성 버튼 클릭 1회)는 `click` 하나로 시작해 아래 끝 중 하나 이상으로 끝난다.
 * - preview: OS 공유 시트를 열려고 navigator.share 를 실제로 호출함(링크 확인 · canShare 통과 뒤, 호출 직전).
 *   시트가 화면에 떴다는 뜻은 아니다. 브라우저가 제스처 만료 등으로 바로 거절하면 failure(native)가 뒤따른다.
 * - native_success: navigator.share 가 resolve 됨(사용자가 OS 시트에서 대상을 고름). 실제 SNS 게시 완료를 보장하지 않는다.
 * - cancel: navigator.share 가 AbortError 로 끝남(사용자가 시트를 닫음). 복사로 넘어가지 않는다.
 * - copy_success: 클립보드 쓰기가 resolve 됨. 붙여 넣기 · 게시는 알 수 없다.
 * - failure: 단계별 실패. link(링크 확인 · 업로드 준비 실패, 공유를 시작하지 못함), native(취소가 아닌 거절 → 복사로 넘어감),
 *   copy(클립보드 거절 → 직접 복사 안내).
 * 네이티브 실패 뒤 복사로 넘어가면 failure(native)와 copy 결과(copy_success 또는 failure(copy))가 각각 한 번씩 남는다.
 */
export type ShareMethod = 'native_share' | 'copy_link';
export type ShareFailureStage = 'link' | 'native' | 'copy';
/** 오류 원문은 보내지 않는다. 이름만 고정 목록으로 줄인다. */
export type ShareErrorKind = 'not_allowed' | 'invalid_data' | 'unknown';

export type ShareOutcome =
  | { kind: 'click' }
  | { kind: 'preview' }
  | { kind: 'native_success' }
  | { kind: 'cancel' }
  | { kind: 'copy_success' }
  | { kind: 'failure'; method: ShareMethod; stage: ShareFailureStage; error: ShareErrorKind };

/** GA4 이벤트 이름. copy_success 는 옛 이름을 그대로 쓴다(T-11-668 전에는 네이티브 성공도 이 이름이었다). */
export const SHARE_EVENT = {
  click: 'career_share_click',
  preview: 'career_share_preview',
  native_success: 'career_share_native_success',
  cancel: 'career_share_cancel',
  copy_success: 'career_share_copy_success',
  failure: 'career_share_failure',
} as const satisfies Record<ShareOutcome['kind'], string>;

/** 이 계약의 판. 옛 이벤트(판 없음)와 GA4에서 나눠 볼 때 쓴다. */
export const SHARE_CONTRACT = '2';

/** 클릭은 아직 방법이 정해지지 않았다(네이티브가 있어도 실패하면 복사로 간다). */
export type ShareClickMethod = 'pending';

export function shareErrorKind(e: unknown): ShareErrorKind {
  const name = (e as { name?: unknown } | null)?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'not_allowed';
  if (name === 'TypeError' || name === 'DataError') return 'invalid_data';
  return 'unknown';
}

/** 이벤트 이름과 매개변수. 웹 GA4 · 앱 계측이 같은 모양으로 보낸다. */
export function shareEventParams(o: ShareOutcome): {
  name: (typeof SHARE_EVENT)[ShareOutcome['kind']];
  params: Record<string, string>;
} {
  const base = { share_contract: SHARE_CONTRACT };
  switch (o.kind) {
    case 'click':
      return {
        name: SHARE_EVENT.click,
        params: { ...base, share_method: 'pending' satisfies ShareClickMethod },
      };
    case 'preview':
    case 'native_success':
    case 'cancel':
      return { name: SHARE_EVENT[o.kind], params: { ...base, share_method: 'native_share' } };
    case 'copy_success':
      return { name: SHARE_EVENT.copy_success, params: { ...base, share_method: 'copy_link' } };
    case 'failure':
      return {
        name: SHARE_EVENT.failure,
        params: {
          ...base,
          share_method: o.method,
          failure_stage: o.stage,
          error_kind: o.error,
        },
      };
  }
}
