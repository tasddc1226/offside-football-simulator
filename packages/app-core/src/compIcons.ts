// ───────── 리그 · 대회 로고 바꾸기 (웹·앱 공용, T-11-681) ─────────
// 리그 · 대회마다 기본 로고(compEmblem.ts가 그리는 엠블럼)가 있고, 유저가 고른 이미지로 내 화면에서만 바꿀 수 있다.
// 정본은 이 기기 저장소(ft_comp_icons)이고, 프로필 세션이 있으면 이름 바꾸기(customNames.ts)와 함께 compCustomSync.ts가
// 계정과 맞춘다(T-11-684). 키는 저장된 한국어 이름(tn 키)이다. 공유 이미지에는 넣지 않는다. 이름 바꾸기와 같은 에디트 파일에도 실린다.
// 첫 화면(부팅)이 읽으므로 무거운 게임 모듈을 가져오지 않는다.
import { loadKey, saveKey } from '@offside/game/storage';
import {
  COMP_CUSTOM_KEY_MAX as KEY_MAX,
  COMP_ICON_IMG_MAX,
  COMP_ICON_IMG_PATTERN as IMG,
  COMP_ICONS_LIMIT,
  COMP_ICONS_TOTAL_MAX,
} from '@offside/contracts/comp-custom-limits';

export { COMP_ICON_IMG_MAX, COMP_ICONS_LIMIT, COMP_ICONS_TOTAL_MAX };

export const COMP_ICONS_KEY = 'ft_comp_icons';
/** 처음 한 번 띄우는 "로고를 눌러 바꿀 수 있어요" 안내를 닫았는지. */
export const COMP_ICON_HINT_KEY = 'ft_comp_icon_hint';
/** importCompIcons: 파일은 멀쩡한데 기기 저장 공간이 모자랐다. */
export const COMP_ICONS_NO_SPACE = -2;

export type CompIconMap = Record<string, string>;
export interface CompIconsState {
  map: CompIconMap;
  /** 안내를 이미 봤는지(닫았거나 로고를 한 번 눌렀다). */
  hinted: boolean;
}
export const initialCompIconsState = (): CompIconsState => ({ map: {}, hinted: false });

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/g;

/** 파일·저장소에서 읽은 값을 로고 표로 — 이미지 data URL만, 개수 · 합계 한도 안에서. */
export function sanitizeCompIcons(raw: unknown): CompIconMap {
  const out: CompIconMap = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  let total = 0;
  for (const [k0, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v !== 'string' || v.length > COMP_ICON_IMG_MAX || !IMG.test(v)) continue;
    const k = k0.replace(CONTROL, '').trim().slice(0, KEY_MAX);
    if (!k || total + v.length > COMP_ICONS_TOTAL_MAX) continue;
    out[k] = v;
    total += v.length;
    if (Object.keys(out).length >= COMP_ICONS_LIMIT) break;
  }
  return out;
}

const totalOf = (map: CompIconMap) => Object.values(map).reduce((n, v) => n + v.length, 0);

/** onChange: 유저가 이 기기에서 바꿨을 때(계정 동기화가 보낼 것이 생겼다). 계정에서 받아 온 값(adoptCompIcons)에는 부르지 않는다. */
export function createCompIcons(state: CompIconsState, onChange?: () => void) {
  function adoptCompIcons(map: CompIconMap): boolean {
    const next = sanitizeCompIcons(map);
    if (!saveKey(COMP_ICONS_KEY, { v: 1, icons: next })) return false;
    state.map = next;
    return true;
  }
  function commit(map: CompIconMap): boolean {
    if (!adoptCompIcons(map)) return false;
    onChange?.();
    return true;
  }

  /** 부팅 때 한 번. */
  function loadCompIcons(): void {
    const raw = loadKey<unknown>(COMP_ICONS_KEY);
    state.map = sanitizeCompIcons(
      raw && typeof raw === 'object' && 'icons' in raw ? (raw as { icons: unknown }).icons : null,
    );
    state.hinted = loadKey<unknown>(COMP_ICON_HINT_KEY) === 1;
  }
  /** 로고 하나를 바꾼다. img가 null이면 기본 로고로. 실패 사유: 'big'(이미지가 크다) · 'full'(합계 · 개수 한도) · 'space'(저장 실패). */
  function setCompIcon(ko: string, img: string | null): true | 'big' | 'full' | 'space' {
    const next = { ...state.map };
    if (img === null) {
      if (!(ko in next)) return true;
      delete next[ko];
      return commit(next) || 'space';
    }
    if (img.length > COMP_ICON_IMG_MAX || !IMG.test(img)) return 'big';
    next[ko] = img;
    if (Object.keys(next).length > COMP_ICONS_LIMIT || totalOf(next) > COMP_ICONS_TOTAL_MAX)
      return 'full';
    return commit(next) || 'space';
  }
  function resetCompIcons(): boolean {
    return commit({});
  }
  /** 에디트 파일에 함께 싣는 값. */
  const exportCompIcons = (): CompIconMap => state.map;
  /** 에디트 파일의 icons로 통째로 바꾼다. 파일에 icons가 없으면 그대로 두고 0. 적용된 수(저장 공간이 모자라면 COMP_ICONS_NO_SPACE). */
  function importCompIcons(raw: unknown): number {
    if (!raw || typeof raw !== 'object' || !('icons' in raw)) return 0;
    const map = sanitizeCompIcons((raw as { icons: unknown }).icons);
    return commit(map) ? Object.keys(map).length : COMP_ICONS_NO_SPACE;
  }
  /** 안내를 닫는다(다시 띄우지 않는다). */
  function dismissCompIconHint(): void {
    if (state.hinted) return;
    state.hinted = true;
    saveKey(COMP_ICON_HINT_KEY, 1);
  }

  return {
    loadCompIcons,
    setCompIcon,
    resetCompIcons,
    exportCompIcons,
    importCompIcons,
    dismissCompIconHint,
    adoptCompIcons,
  };
}
