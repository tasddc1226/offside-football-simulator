// 배경음악 켜기/끄기. 기본은 꺼짐이고 이 기기에만 저장된다(ft_bgm). 게임 화면과 기록실을 뺀 하단 메뉴 화면에서,
// 탭이 보일 때만 튼다. 이 화면들 사이를 오가는 동안은 끊지 않고 이어서 튼다. 재생기(bgmEngine.ts)와 음원은 처음
// 틀 때 불러온다. 브라우저는 사용자 동작 없이 소리를 못 내게 하므로, 켜 둔 채 새로 열었으면 첫 터치에 시작한다.
import { loadKey, saveKey } from '../game/season.js';
import type { Bgm } from './bgmEngine.js';
import { appState, type Screen } from './state.svelte.js';

const KEY = 'ft_bgm';
/** 배경음악을 트는 화면 — 게임(모든 탭)과 기록실을 뺀 하단 메뉴 화면. */
export const BGM_SCREENS: readonly Screen[] = ['game', 'home', 'board', 'owner', 'settings'];

export const bgm = $state({ on: loadKey<boolean>(KEY) ?? false });

let engine: Promise<Bgm | null> | null = null;

const wanted = () => bgm.on && BGM_SCREENS.includes(appState.screen) && !document.hidden;

function sync() {
  if (wanted()) {
    engine ??= import('./bgmEngine.js').then(
      (m) => m.createBgm(),
      () => null, // 오디오를 못 쓰는 환경·청크 실패는 조용히 넘어간다.
    );
    void engine.then((e) => (wanted() ? e?.play() : e?.pause()));
  } else void engine?.then((e) => e?.pause());
}

export function setBgm(on: boolean) {
  bgm.on = on;
  saveKey(KEY, on);
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
