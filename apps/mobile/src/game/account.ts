// 구단주 계정(구글·애플 로그인) — 서버 commentIdentity·hasAccount와 같은 자격(내 팀·댓글·닉네임·계정 기록).
import type { Profile } from '@offside/app-core/api/client';

export const isMember = (p: Profile) => p.linked.google || p.linked.apple;
