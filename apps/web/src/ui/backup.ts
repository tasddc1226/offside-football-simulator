// ───────── 진행 중 커리어 백업 코드 (T-10-116) ─────────
// 세이브(ft_save)는 이 브라우저의 localStorage에만 있다 — 카톡 인앱 브라우저 → 사파리, 홈 화면 앱 설치(저장소 분리),
// iOS 7일 미접속 정리에서 사라지거나 갈라진다. 그래서 세이브를 한 덩어리 문자열(백업 코드/파일)로 뽑고 다시 받는다.
//
// 형식: base64(UTF-8 JSON { v: 1, at: ISO 시각, save: ft_save 객체, hof?: ft_hof 배열 }). 파일은 같은 JSON 그대로다
// (읽을 때는 JSON이든 base64든 받는다).
// 담는 키: `ft_save`(필수)와 `ft_hof`(이 기기 은퇴 선수 기록, 있으면). `ft_scout_seed`는 선수 생성 후보의 시드라
// 커리어가 시작된 세이브에는 쓸모가 없어 뺐다. 로그인·세션·프로필·설정 키는 절대 담지 않는다.
// 가져올 때는 아래 WRITE_KEYS 두 개만 쓴다 — 백업에 다른 키가 있어도 무시한다.
import { SAVE_VERSION } from '../game/data.js';
import { getActiveRng, setActiveRng } from '../game/rng.js';
import { loadSave } from '../game/save.js';
import { HOF_LOCAL_MAX, saveKey } from '../game/season.js';
import type { GameState, HofEntry } from '../game/types.js';

export const BACKUP_VERSION = 1;
/** 가져오기가 쓸 수 있는 localStorage 키(화이트리스트). */
export const WRITE_KEYS = ['ft_save', 'ft_hof'] as const;
/** 붙여넣은 글이 이보다 길면 세이브가 아니다(메모리 보호). */
const MAX_TEXT = 12_000_000;

export interface Backup {
  v: typeof BACKUP_VERSION;
  at: string;
  save: GameState;
  hof?: HofEntry[];
}
export type DecodeFail = 'empty' | 'format' | 'version' | 'save' | 'saveVersion' | 'tooLarge';
export type DecodeResult = { ok: true; backup: Backup } | { ok: false; reason: DecodeFail };

const isObj = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

// ───────── 인코딩 ─────────
function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function fromBase64(b64: string): string {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

/** 백업 JSON 문자열(파일 내용)과 백업 코드(base64)를 만든다. */
export function encodeBackup(
  save: unknown,
  hof: unknown[] = [],
  now: Date = new Date(),
): { json: string; code: string } {
  const body: Record<string, unknown> = { v: BACKUP_VERSION, at: now.toISOString(), save };
  if (hof.length) body.hof = hof;
  const json = JSON.stringify(body);
  return { json, code: toBase64(json) };
}

/** 백업 파일 이름 `offside-backup-YYYYMMDD.json`(기기 시간 기준 날짜). */
export function backupFileName(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `offside-backup-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}.json`;
}

// ───────── 디코딩 · 검증 ─────────
/** 세이브의 뼈대가 게임이 읽는 모양인지(화면이 깨지지 않을 최소 조건). */
function saveShapeOk(s: Record<string, unknown>): boolean {
  const num = (k: string) => typeof s[k] === 'number' && Number.isFinite(s[k] as number);
  return (
    typeof s.name === 'string' &&
    typeof s.pos === 'string' &&
    typeof s.leagueId === 'string' &&
    num('age') &&
    num('year') &&
    isObj(s.attrs) &&
    isObj(s.club) &&
    typeof s.club.id === 'string' &&
    isObj(s.season) &&
    Array.isArray(s.career) &&
    Array.isArray(s.log) &&
    isObj(s.flags)
  );
}

/** 저장 후보를 복사본으로 실제 불러오기 경로(loadSave → migrateSave)에 태워 본다. 그 경로가 활성 RNG를 바꾸므로
 * 진행 중 게임의 RNG 객체는 끝나고 다시 꽂는다(migrateSave는 새 RNG를 만들 뿐 기존 것은 건드리지 않는다). */
function migratesOk(save: unknown): boolean {
  const prev = getActiveRng();
  try {
    return loadSave(structuredClone(save) as GameState) != null;
  } catch {
    return false;
  } finally {
    setActiveRng(prev);
  }
}

const hofEntryOk = (h: unknown): h is HofEntry =>
  isObj(h) &&
  typeof h.name === 'string' &&
  typeof h.score === 'number' &&
  Number.isFinite(h.score) &&
  typeof h.pos === 'string';

/** 백업 코드(base64) 또는 백업 파일(JSON) 글을 검증해 되돌린다. 저장소는 건드리지 않는다. */
export function decodeBackup(text: string): DecodeResult {
  const t = text.trim();
  if (!t) return { ok: false, reason: 'empty' };
  if (t.length > MAX_TEXT) return { ok: false, reason: 'tooLarge' };
  let raw: unknown;
  try {
    // 코드는 복사 과정에서 줄바꿈·공백이 끼기 쉽다 — 다 걷어 낸다.
    raw = JSON.parse(t.startsWith('{') ? t : fromBase64(t.replace(/\s+/g, '')));
  } catch {
    return { ok: false, reason: 'format' };
  }
  if (!isObj(raw) || !isObj(raw.save)) return { ok: false, reason: 'format' };
  if (raw.v !== BACKUP_VERSION) return { ok: false, reason: 'version' };
  if (raw.save.v !== SAVE_VERSION) return { ok: false, reason: 'saveVersion' };
  if (!saveShapeOk(raw.save) || !migratesOk(raw.save)) return { ok: false, reason: 'save' };
  const hof = Array.isArray(raw.hof) ? raw.hof.filter(hofEntryOk).slice(0, HOF_LOCAL_MAX) : [];
  return {
    ok: true,
    backup: {
      v: BACKUP_VERSION,
      at: typeof raw.at === 'string' ? raw.at : '',
      save: raw.save as unknown as GameState,
      ...(hof.length ? { hof } : {}),
    },
  };
}

// ───────── 적용 ─────────
/** 이 기기 은퇴 선수 기록에 백업의 기록을 합친다: 같은 커리어 id는 이 기기 것을 지킨다(id 없는 옛 항목은 이름·나이·
 * 최고 능력치가 같으면 같은 선수). 점수 순으로 세워 로컬 최대치까지만 남긴다. */
export function mergeHof(mine: HofEntry[], incoming: HofEntry[]): HofEntry[] {
  const keyOf = (h: HofEntry) => h.id ?? `${h.name}|${h.age}|${h.peak}`;
  const seen = new Set(mine.map(keyOf));
  const add = incoming.filter((h) => !seen.has(keyOf(h)) && !!seen.add(keyOf(h)));
  return [...mine, ...add].sort((a, b) => b.score - a.score).slice(0, HOF_LOCAL_MAX);
}

/** 검증된 백업을 화이트리스트 키(WRITE_KEYS)에만 쓴다. 세이브를 못 쓰면(용량) 원래대로 되돌리고 false. */
export function applyBackup(b: Backup, currentHof: HofEntry[]): boolean {
  let prev: string | null;
  try {
    prev = localStorage.getItem('ft_save');
  } catch {
    return false;
  }
  if (!saveKey('ft_save', b.save)) {
    try {
      if (prev != null) localStorage.setItem('ft_save', prev);
    } catch {
      // 되돌리지 못해도 새 값은 쓰이지 않았다(setItem이 던지면 기존 값이 남는다).
    }
    return false;
  }
  // 기록 합치기는 덤이다 — 실패해도 세이브는 이미 옮겨졌다.
  if (b.hof) saveKey('ft_hof', mergeHof(currentHof, b.hof));
  return true;
}
