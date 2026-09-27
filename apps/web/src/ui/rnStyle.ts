import { clubById } from '../game/clubs.js';
import { crestOf } from '../game/crests.js';

/** 밝은 유니폼이면 등번호를 어둡게. */
const light = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 170;
};

/** T-10-076 결번 유니폼 색(구단 엠블럼 색) — style 속성 문자열. 모르는 구단이면 ''(기본 색). */
export function rnStyle(clubId: string | undefined): string {
  const club = clubId ? clubById(clubId) : null;
  if (!club) return '';
  const c = crestOf(club);
  return `--rn-base:${c.base};--rn-accent:${c.accent};--rn-ink:${light(c.base) ? '#111a14' : '#ffffff'}`;
}

/** 결번 유니폼 윤곽·깃(viewBox 0 0 120 124). 은퇴 세리머니와 영구결번 알림이 같이 쓴다. */
export const RN_SHIRT =
  'M40 6 L22 12 L4 34 L18 48 L28 40 L28 118 L92 118 L92 40 L102 48 L116 34 L98 12 L80 6 Q60 20 40 6 Z';
export const RN_TRIM = 'M40 6 Q60 20 80 6';
