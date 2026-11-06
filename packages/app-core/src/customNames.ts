// ───────── 대회·수상 이름 바꾸기 (웹·앱 공용, T-11-647) ─────────
// 유저가 대회·수상·리그 이름을 이 기기에서만 바꿔 부른다. 서버에 보내지 않고(동기화 없음) 이 기기 저장소(ft_custom_names)에만
// 둔다. 화면은 tn()이 이 이름표를 거쳐 그리고, 저장값·판정·서버 기록은 그대로다. 남에게 나가는 공유 이미지는 원래 이름이다.
// 기기를 옮길 때는 에디트 파일(JSON)로 내보내고 가져온다. 반응성은 클라이언트가 붙인다(웹 $state, 앱 valtio).
// 첫 화면(부팅)이 읽으므로 무거운 게임 모듈을 가져오지 않는다 — 고를 이름 목록은 customNamesCatalog.ts에 있다.
import { loadKey, saveKey } from '@offside/game/storage';
import { setCustomNames } from '@offside/game/i18n/names';

export const CUSTOM_NAMES_KEY = 'ft_custom_names';
/** 바꾼 이름 하나의 최대 글자 수. */
export const CUSTOM_NAME_MAX = 30;
/** 원래 이름(키)의 최대 글자 수 — 게임 이름보다 넉넉하게. */
const KEY_MAX = 60;
/** 이름표에 남기는 최대 수. */
export const CUSTOM_NAMES_LIMIT = 500;
/** importCustomNames: 파일은 멀쩡한데 기기 저장 공간이 모자랐다(형식 오류 -1과 구분한다). */
export const CUSTOM_NAMES_NO_SPACE = -2;

export type CustomNameMap = Record<string, string>;
export interface CustomNamesState {
  map: CustomNameMap;
}
export const initialCustomNamesState = (): CustomNamesState => ({ map: {} });

// 줄바꿈·제어 문자는 빼고 앞뒤 공백을 지운다.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/g;
const clean = (v: string, max: number) => v.replace(CONTROL, '').trim().slice(0, max);

/** 파일·저장소에서 읽은 값을 이름표로 — 문자열 쌍만, 빈 값·원래와 같은 값은 뺀다. */
export function sanitizeCustomNames(raw: unknown): CustomNameMap {
  const out: CustomNameMap = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k0, v0] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v0 !== 'string') continue;
    const k = clean(k0, KEY_MAX);
    const v = clean(v0, CUSTOM_NAME_MAX);
    if (!k || !v || v === k) continue;
    out[k] = v;
    if (Object.keys(out).length >= CUSTOM_NAMES_LIMIT) break;
  }
  return out;
}

function readStored(): CustomNameMap {
  const raw = loadKey<unknown>(CUSTOM_NAMES_KEY);
  return sanitizeCustomNames(
    raw && typeof raw === 'object' && 'names' in raw ? (raw as { names: unknown }).names : null,
  );
}

export function createCustomNames(state: CustomNamesState) {
  function commit(map: CustomNameMap): boolean {
    const next = sanitizeCustomNames(map);
    if (!saveKey(CUSTOM_NAMES_KEY, { v: 1, names: next })) return false;
    state.map = next;
    setCustomNames(next);
    return true;
  }

  /** 부팅 때 한 번 — 첫 화면을 그리기 전에 이름표를 tn()에 건다. */
  function loadCustomNames(): void {
    const map = readStored();
    state.map = map;
    setCustomNames(map);
  }
  /** 이름 하나를 바꾼다. 빈 값이면 원래 이름으로 되돌린다. 저장하지 못하면 false. */
  function setCustomName(original: string, value: string): boolean {
    const next = { ...state.map };
    const v = clean(value, CUSTOM_NAME_MAX);
    if (v && v !== original) next[original] = v;
    else delete next[original];
    if (!next[original] && !state.map[original]) return true;
    if (next[original] && Object.keys(next).length > CUSTOM_NAMES_LIMIT) return false;
    return commit(next);
  }
  /** 고른 이름만(없으면 전부) 원래대로. */
  function resetCustomNames(originals?: readonly string[]): boolean {
    if (!originals) return commit({});
    const next = { ...state.map };
    for (const k of originals) delete next[k];
    return commit(next);
  }
  const exportCustomNames = (): string => JSON.stringify({ v: 1, names: state.map }, null, 1);
  /** 가져온 파일로 통째로 바꾼다. 적용된 이름 수(형식이 틀리면 -1, 저장 공간이 모자라면 CUSTOM_NAMES_NO_SPACE). */
  function importCustomNames(text: string): number {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return -1;
    }
    if (!raw || typeof raw !== 'object' || !('names' in raw)) return -1;
    const map = sanitizeCustomNames((raw as { names: unknown }).names);
    return commit(map) ? Object.keys(map).length : CUSTOM_NAMES_NO_SPACE;
  }

  return {
    loadCustomNames,
    setCustomName,
    resetCustomNames,
    exportCustomNames,
    importCustomNames,
  };
}
