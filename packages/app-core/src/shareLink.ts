// ───────── 은퇴 커리어 공유 링크 (웹·앱 공용, T-10-029 · 공용 T-11-044) ─────────
// 보기 전용 링크(/career/<id>)는 공개 명예의 전당 상세라 로그인과 무관하다. 링크를 건네기 전에 서버에 있는지 확인한다.
import { getHofDetail } from './api/client.js';
import { shareText as L } from './i18n/ko/share.js';
import { retirementUploadStatus, type RejectReason, type UploadStatus } from './outboxStore.js';

/** 언어를 바꾸면 달라져야 하므로 읽을 때 고른다(모듈 최상위 상수로 굳히지 않는다). */
export const shareLinkTitle = (): string => L.linkTitle;
export const shareLinkText = (): string => L.linkText;

/**
 * 링크를 서버에 확인하고 돌려준다. 은퇴 기록이 아직 서버에 안 올라갔으면(오프라인이었거나 막 은퇴한 직후) 링크가
 * 404라 먼저 업로드 큐를 비운다(flush 실패는 무시). 확인에 실패하면 화면에 띄울 문구로 던진다.
 */
export async function checkShareLink(
  id: string,
  deps: { flush: () => Promise<unknown>; url: (id: string) => string },
): Promise<string> {
  await deps.flush().catch(() => {});
  const r = await getHofDetail(id);
  if (!r.ok) {
    if (r.error.reason !== 'HOF_NOT_FOUND') throw new Error(L.noConnection);
    // T-11-433 서버가 거절한 기록은 다시 해도 같으니 '잠시 후' 대신 이유를 말한다.
    const status = retirementUploadStatus(id);
    throw new Error(
      status.state === 'rejected'
        ? L.rejectedLink({ reason: rejectReasonText(status.reason) })
        : L.notUploaded,
    );
  }
  return deps.url(id);
}

/** T-11-433 거절 사유를 사람이 읽을 문구로. */
export function rejectReasonText(reason: RejectReason): string {
  switch (reason) {
    case 'noSeasons':
      return L.rejectNoSeasons;
    case 'name':
      return L.rejectName;
    case 'tooLarge':
      return L.rejectTooLarge;
    case 'owner':
      return L.rejectOwner;
    case 'invalid':
      return L.rejectInvalid;
    default:
      return L.rejectUnknown;
  }
}

/** T-11-433 공유 바 위 상태 줄. 완료면 줄을 그리지 않는다(null). retry: '다시 올리기' 버튼을 둘지(대기일 때만). */
export function uploadStatusLine(status: UploadStatus): { text: string; retry: boolean } | null {
  switch (status.state) {
    case 'pending':
      return { text: L.uploadPending, retry: true };
    case 'sending':
      return { text: L.uploadSending, retry: false };
    case 'rejected':
      return { text: L.uploadRejected({ reason: rejectReasonText(status.reason) }), retry: false };
    default:
      return null;
  }
}

/** T-11-433 '다시 올리기'를 누른 뒤 띄울 토스트. 거절이면 사유를, 아직 대기면 연결 안내를 말한다. */
export function retryResultText(status: UploadStatus): string {
  if (status.state === 'done') return L.uploadDone;
  if (status.state === 'rejected')
    return L.uploadRejected({ reason: rejectReasonText(status.reason) });
  return L.uploadStill;
}
