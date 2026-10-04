// ───────── 은퇴 커리어 공유 링크 (웹·앱 공용, T-10-029 · 공용 T-11-044) ─────────
// 보기 전용 링크(/career/<id>)는 공개 명예의 전당 상세라 로그인과 무관하다. 링크를 건네기 전에 서버에 있는지 확인한다.
import { getHofDetail } from './api/client.js';

export const SHARE_TITLE = '오프사이드 은퇴 커리어';
export const SHARE_TEXT = '내 선수의 축구 인생. 오프사이드 offside-lab.com';

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
    throw new Error(
      r.error.reason === 'HOF_NOT_FOUND'
        ? '기록을 아직 서버에 올리지 못했어요. 잠시 후 다시 시도해 주세요.'
        : '서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.',
    );
  }
  return deps.url(id);
}
