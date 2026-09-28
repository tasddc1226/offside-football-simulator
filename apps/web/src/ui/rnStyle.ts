import { clubById } from '../game/clubs.js';
import { crestOf } from '../game/crests.js';

const rgb = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [n >> 16, (n >> 8) & 255, n & 255] as const;
};
/** 밝은 유니폼이면 등번호를 어둡게. */
const light = (hex: string) => {
  const [r, g, b] = rgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b > 170;
};
/** 두 색이 눈으로 잘 구분되지 않을 만큼 가까운가. */
const near = (a: string, b: string) => {
  const [x, y] = [rgb(a), rgb(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 90;
};

/** T-10-076 결번 유니폼 색(구단 엠블럼 색) — style 속성 문자열. 모르는 구단이면 ''(기본 색). */
export function rnStyle(clubId: string | undefined): string {
  const club = clubId ? clubById(clubId) : null;
  if (!club) return '';
  const c = crestOf(club);
  const ink = light(c.base) ? '#111a14' : '#ffffff';
  // 강조색이 바탕과 비슷하면(단색 엠블럼) 깃·소매 띠·번호 테두리는 등번호 색으로.
  return `--rn-base:${c.base};--rn-accent:${c.accent};--rn-ink:${ink};--rn-trim:${near(c.base, c.accent) ? ink : c.accent}`;
}

/** 결번 유니폼 윤곽·깃(viewBox 0 0 120 124). 은퇴 세리머니와 영구결번 알림이 같이 쓴다. */
export const RN_SHIRT =
  'M40 6 L22 12 L4 34 L18 48 L28 40 L28 118 L92 118 L92 40 L102 48 L116 34 L98 12 L80 6 Q60 20 40 6 Z';
export const RN_TRIM = 'M40 6 Q60 20 80 6';
