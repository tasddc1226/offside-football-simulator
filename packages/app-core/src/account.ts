// 구단주 계정(구글·애플 로그인) — 서버 commentIdentity·hasAccount와 같은 자격(내 팀·댓글·닉네임·계정 기록).
// 웹·앱이 같은 판정을 쓴다(웹은 구글만 보다가 애플 전용 계정을 게스트로 다룬 적이 있다, T-11-044).
import type { Profile } from './api/client.js';

export const isMember = (p: Pick<Profile, 'linked'>): boolean => p.linked.google || p.linked.apple;

/** 계정 카드 제목·안내. 구글이 연결돼 있으면 구글을 먼저 보인다. */
export function accountLabel(p: Pick<Profile, 'linked' | 'googleEmailMasked'>): {
  title: string;
  via: string;
} {
  return p.linked.google
    ? { title: p.googleEmailMasked ?? '구글 계정', via: 'Google 계정으로 로그인했어요.' }
    : { title: 'Apple 계정', via: 'Apple 계정으로 로그인했어요.' };
}
