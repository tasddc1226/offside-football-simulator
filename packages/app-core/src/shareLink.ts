// ───────── 은퇴 커리어 공유 링크 (웹·앱 공용, T-10-029 · 공용 T-11-044) ─────────
// 보기 전용 링크(/career/<id>)는 공개 명예의 전당 상세라 로그인과 무관하다. 링크를 건네기 전에 서버에 있는지 확인한다.
import { getHofDetail } from './api/client.js';
import { shareText as L } from './i18n/ko/share.js';

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
    throw new Error(r.error.reason === 'HOF_NOT_FOUND' ? L.notUploaded : L.noConnection);
  }
  return deps.url(id);
}
