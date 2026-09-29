// 배경음악 켜기/끄기. 기본은 꺼짐이고 이 기기에만 저장된다(ft_bgm). 화면마다 곡이 정해져 있고(TRACK_OF), 탭이 보일
// 때만 튼다. 같은 곡의 화면끼리 오가는 동안은 끊지 않고 이어서 튼다. 음원은 처음 틀 때 받는다. 브라우저(특히
// 아이폰)는 사용자 동작 안에서 부른 play()만 허락하므로, 재생기는 지연 로드하지 않고 터치 처리 안에서 바로 부른다.
// 켜 둔 채 새로 열었으면 첫 터치에 시작한다.
import { loadKey, saveKey } from '@offside/game/season';
import { createBgm, type Bgm, type BgmTrack } from './bgmEngine.js';
import { appState, type Screen } from './state.svelte.js';

const KEY = 'ft_bgm';
const VOLUME_KEY = 'ft_bgm_volume';
/** 설정의 음량 슬라이더 기본값(0–100). */
const DEFAULT_VOLUME = 70;
/** 화면 → 곡. 게임(모든 탭)과 홈·소식·구단주·설정은 main, 기록실과 선수 상세는 records. 없는 화면에선 멈춘다. */
const TRACK_OF: Partial<Record<Screen, BgmTrack>> = {
  game: 'main',
  home: 'main',
  board: 'main',
  owner: 'main',
  settings: 'main',
  hof: 'records',
  legend: 'records',
};
/** 배경음악을 트는 화면인지(상단 스위치를 보인다). */
export const hasBgm = (s: Screen) => s in TRACK_OF;

export const bgm = $state({
  on: loadKey<boolean>(KEY) ?? false,
  /** 0–100. */
  volume: loadKey<number>(VOLUME_KEY) ?? DEFAULT_VOLUME,
});

let engine: Bgm | null = null;

/** 지금 틀 곡. 꺼져 있거나 탭이 가려졌거나 음악 없는 화면이면 null. */
const wanted = () => (bgm.on && !document.hidden && TRACK_OF[appState.screen]) || null;

function sync() {
  const track = wanted();
  if (track) (engine ??= createBgm()).play(track, bgm.volume / 100);
  else engine?.pause();
}

export function setBgm(on: boolean) {
  bgm.on = on;
  saveKey(KEY, on);
  sync();
}

/** 설정의 음량 슬라이더. 틀고 있으면 바로 반영한다. */
export function setBgmVolume(volume: number) {
  bgm.volume = Math.max(0, Math.min(100, Math.round(volume)));
  saveKey(VOLUME_KEY, bgm.volume);
  sync();
}

export function watchBgm() {
  $effect.root(() => {
    $effect(() => {
      void [bgm.on, appState.screen];
      sync();
    });
  });
  document.addEventListener('visibilitychange', sync);
  // 켜 둔 채 새로 열었으면 첫 터치(사용자 동작)에 오디오를 깨운다.
  document.addEventListener('pointerdown', () => wanted() && sync(), {
    capture: true,
    passive: true,
  });
}
