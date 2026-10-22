// 구단주 계정(구글·애플 로그인) — 서버 commentIdentity·hasAccount와 같은 자격(내 팀·댓글·닉네임·계정 기록).
// 웹·앱이 같은 판정을 쓴다(웹은 구글만 보다가 애플 전용 계정을 게스트로 다룬 적이 있다, T-11-044).
import type { ApiResult, Profile } from './api/client.js';
import { accountText as L } from './i18n/ko/account.js';

export const isMember = (p: Pick<Profile, 'linked'>): boolean => p.linked.google || p.linked.apple;

/** 계정 카드 제목·안내. 구글이 연결돼 있으면 구글을 먼저 보인다. */
export function accountLabel(p: Pick<Profile, 'linked' | 'googleEmailMasked'>): {
  title: string;
  via: string;
} {
  return p.linked.google
    ? { title: p.googleEmailMasked ?? L.googleTitle, via: L.googleVia }
    : { title: L.appleTitle, via: L.appleVia };
}

/** T-11-441 계정 삭제: 삭제 시작(확인 토큰) → 삭제 확정. 둘 중 하나라도 실패하면 false.
 *  웹·앱이 같은 순서로 부르고, 결과에 따라 삭제 완료·실패 안내를 띄운다(실패는 연결 오류 카드로 덮지 않는다). */
export async function runProfileDeletion(api: {
  start: () => Promise<ApiResult<{ confirmToken: string }>>;
  confirm: (confirmToken: string) => Promise<ApiResult<undefined>>;
}): Promise<boolean> {
  const start = await api.start();
  if (!start.ok) return false;
  return (await api.confirm(start.data.confirmToken)).ok;
}
