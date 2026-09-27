// ───────── 클럽 이름·로고 커스터마이즈 (T-10-009) ─────────
// 유저가 리그별 클럽의 이름과 로고를 바꿀 수 있다. 이 파일은 DOM·저장소를 모르는 순수 로직이고,
// 저장/반응형 상태는 ui/clubCustom.svelte.ts가 맡는다.
// - 이름: CLUBS[].name을 직접 바꾼다 — 오퍼·경기 상대·기록 문구가 모두 CLUBS에서 이름을 읽으므로
//   바꾼 뒤부터 생기는 기록에 새 이름이 쓰인다(이미 남은 기록·로그 문구는 그대로다).
// - 로고: 게임 로직과 무관한 표시 전용 값이라 CLUBS에 넣지 않고 id → 로고 맵으로만 둔다.
import { CLUBS, type Club } from './data.js';
import { clubInitial, crestOf } from './crests.js';
import { SANGMU } from './military.js';
import { CLUB_CUSTOM_IMG_MAX } from '@offside/contracts/club-limits';

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

function cleanLogo(v: unknown): ClubLogo | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  const text =
    typeof o.text === 'string' ? [...o.text.trim()].slice(0, LOGO_TEXT_MAX).join('') : '';
  const bg = typeof o.bg === 'string' && HEX.test(o.bg) ? o.bg : null;
  const fg = typeof o.fg === 'string' && HEX.test(o.fg) ? o.fg : null;
  const img =
    typeof o.img === 'string' && o.img.length <= CLUB_CUSTOM_IMG_MAX && IMG.test(o.img)
      ? o.img
      : undefined;
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
  byName = null;
}

// 글자 엠블럼 편집의 시작값: 이름 첫 글자 + 지금 보이는 기본 엠블럼(game/crests.ts, T-10-063)의 바탕·상징 색.
export function defaultLogo(club: Pick<Club, 'id' | 'name'>): ClubLogo {
  const c = crestOf(club);
  const fg = [c.motifColor, c.edge, c.accent].find((v) => v && v !== c.base) ?? '#ffffff';
  return { text: clubInitial(club.name), bg: c.base, fg };
}
/**
 * T-10-064. T-10-066 이전 기록(커리어 표·우승·명예의 전당·라이브)은 클럽을 id 없이 이름으로만 남겼다 — 이름으로 클럽을 되찾는다.
 * 지금 이름(유저가 바꾼 이름 포함)이나 기본 별칭이 같으면 그 클럽. 다른 유저가 바꿔 부른 이름·대표팀은 null.
 */
let byName: Map<string, Pick<Club, 'id' | 'name'>> | null = null;
export function clubByName(name: string): Pick<Club, 'id' | 'name'> | null {
  // 이름이 바뀌는 곳은 applyClubNames뿐 — 거기서 비우고 다음 조회 때 다시 만든다. 지금 이름이 기본 별칭보다 우선.
  byName ??= new Map<string, Pick<Club, 'id' | 'name'>>([
    ...CLUBS.flatMap((c) => (c.baseName ? [[c.baseName, c] as const] : [])),
    ...CLUBS.map((c) => [c.name, c] as const),
    [SANGMU.name, SANGMU],
  ]);
  return byName.get(name) ?? null;
}
/** T-10-066. 기록에 남은 클럽 id로 클럽을 찾는다(이름이 바뀌어도 같은 클럽). 모르는 id면 null. */
export function clubById(id: string): Pick<Club, 'id' | 'name'> | null {
  return id === SANGMU.id ? SANGMU : (CLUBS.find((c) => c.id === id) ?? null);
}
export const logoOf = (club: Pick<Club, 'id' | 'name'>, map: ClubCustomMap): ClubLogo =>
  map[club.id]?.logo ?? defaultLogo(club);
