// ───────── 클럽 이름·로고 커스터마이즈 (T-10-009) ─────────
// 유저가 리그별 클럽의 이름과 로고를 바꿀 수 있다. 이 파일은 DOM·저장소를 모르는 순수 로직이고,
// 저장/반응형 상태는 ui/clubCustom.svelte.ts가 맡는다.
// - 이름: CLUBS[].name을 직접 바꾼다 — 오퍼·경기 상대·기록 문구가 모두 CLUBS에서 이름을 읽으므로
//   바꾼 뒤부터 생기는 기록에 새 이름이 쓰인다(이미 남은 기록·로그 문구는 그대로다).
// - 로고: 게임 로직과 무관한 표시 전용 값이라 CLUBS에 넣지 않고 id → 로고 맵으로만 둔다.
import { CLUBS, type Club } from './data.js';

export const CLUB_NAME_MAX = 20;
export const LOGO_TEXT_MAX = 3;

export interface ClubLogo {
  /** 엠블럼 가운데 글자(1~3자). */
  text: string;
  bg: string;
  fg: string;
  /** 업로드 이미지(data URL). 있으면 text/bg/fg 대신 이 이미지를 쓴다. */
  img?: string;
}
export interface ClubCustom {
  name?: string;
  logo?: ClubLogo;
}
export type ClubCustomMap = Record<string, ClubCustom>;

const HEX = /^#[0-9a-f]{6}$/i;
const IMG = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
// 서버 계약(contracts CLUB_CUSTOM_IMG_MAX)과 같은 한도 — 64px 엠블럼이면 넉넉하다.
export const IMG_MAX = 16_000;

function cleanLogo(v: unknown): ClubLogo | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  const text = typeof o.text === 'string' ? [...o.text.trim()].slice(0, LOGO_TEXT_MAX).join('') : '';
  const bg = typeof o.bg === 'string' && HEX.test(o.bg) ? o.bg : null;
  const fg = typeof o.fg === 'string' && HEX.test(o.fg) ? o.fg : null;
  const img = typeof o.img === 'string' && o.img.length <= IMG_MAX && IMG.test(o.img) ? o.img : undefined;
  if (!bg || !fg) return undefined;
  return img ? { text, bg, fg, img } : { text, bg, fg };
}

/** 저장소·가져오기 파일에서 읽은 값을 검증한다 — 없는 클럽 id, 형식이 틀린 값은 버린다. */
export function sanitizeClubCustom(raw: unknown): ClubCustomMap {
  const out: ClubCustomMap = {};
  if (!raw || typeof raw !== 'object') return out;
  const ids = new Set(CLUBS.map((c) => c.id));
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!ids.has(id) || !v || typeof v !== 'object') continue;
    const o = v as Record<string, unknown>;
    const name = typeof o.name === 'string' ? o.name.trim().slice(0, CLUB_NAME_MAX) : '';
    const logo = cleanLogo(o.logo);
    if (name || logo) out[id] = { ...(name ? { name } : {}), ...(logo ? { logo } : {}) };
  }
  return out;
}

/** 커스텀 이름을 CLUBS에 반영한다. 맵에 없는 클럽은 기본 이름으로 되돌린다. */
export function applyClubNames(map: ClubCustomMap): void {
  for (const c of CLUBS) c.name = map[c.id]?.name || c.baseName || c.name;
}

// 기본 엠블럼: 이름 첫 글자 + id에서 뽑은 고정 색. 같은 클럽은 늘 같은 색이다.
// FNV-1a — 'pl-1'과 'pl-2'처럼 끝 글자만 다른 id도 색이 크게 갈리게 한다.
function hue(id: string): number {
  let h = 0x811c9dc5;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) % 360;
}
function hslHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
export function defaultLogo(club: Pick<Club, 'id' | 'name'>): ClubLogo {
  return { text: [...club.name.replace(/^FC\s+/, '')][0] ?? '?', bg: hslHex(hue(club.id), 0.55, 0.32), fg: '#ffffff' };
}
export const logoOf = (club: Pick<Club, 'id' | 'name'>, map: ClubCustomMap): ClubLogo => map[club.id]?.logo ?? defaultLogo(club);
