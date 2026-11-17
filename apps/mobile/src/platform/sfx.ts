// T-11-738 결과 효과음(웹 apps/web/src/ui/sfx.ts의 playSfx와 같은 소리 · 같은 순간). 음원은 @offside/app-core/sfx의
// renderSfx로 만든 WAV(assets/sfx, sfx.test.mjs가 설계와 같은지 확인한다)라 샘플 저작권이 없다.
// 설정의 효과음 스위치(ft_sfx)를 따르고, 기기 무음 모드에서는 나지 않으며 다른 앱 소리를 끊지 않는다(섞어서 낸다).
// expo-audio가 없는 옛 스토어 빌드(OTA)에서는 아무 소리도 내지 않는다.
import { AppState } from 'react-native';
import { createSfxGate } from '@offside/app-core/sfx';
import type { SfxId } from '@offside/app-core/sfxKind';
import { prefs } from '../store';

/* eslint-disable @typescript-eslint/no-require-imports */
const SOURCES: Record<SfxId, number> = {
  reward: require('../../assets/sfx/reward.wav'),
  good: require('../../assets/sfx/good.wav'),
  great: require('../../assets/sfx/great.wav'),
  keep: require('../../assets/sfx/keep.wav'),
  bad: require('../../assets/sfx/bad.wav'),
  found: require('../../assets/sfx/found.wav'),
  whistle: require('../../assets/sfx/whistle.wav'),
  trophy: require('../../assets/sfx/trophy.wav'),
  fulltime: require('../../assets/sfx/fulltime.wav'),
};
/* eslint-enable @typescript-eslint/no-require-imports */

type AudioModule = typeof import('expo-audio');
type Player = ReturnType<AudioModule['createAudioPlayer']>;

let audio: Promise<AudioModule | null> | null = null;
const players = new Map<SfxId, Player>();
const gate = createSfxGate();

// T-11-745 모듈이 없는 번들(expo-audio를 뺀 옛 스토어 빌드 OTA)에서 Metro의 import()는 거부된 Promise가 아니라
// 그 자리에서 바로 "Cannot find module"을 던진다. .catch가 붙기 전이라 애니메이션 콜백까지 올라가 앱이 꺼졌다.
// async 함수 안의 try로 감싸 동기 throw도 null로 바꾼다.
async function importAudio(): Promise<AudioModule | null> {
  try {
    const m = await import('expo-audio');
    // 효과음이라 무음 스위치를 따르고(playsInSilentMode: false) 음악 · 영상과 섞는다.
    await m
      .setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' })
      .catch(() => {});
    return m;
  } catch {
    return null;
  }
}

function load(): Promise<AudioModule | null> {
  return (audio ??= importAudio());
}

/** 결과 효과음을 튼다. 꺼 두었거나 앱이 화면에 없으면 아무것도 하지 않는다. */
export function playSfx(id: SfxId): void {
  try {
    playNow(id);
  } catch {
    // 효과음은 어떤 경우에도 화면 동작을 막지 않는다.
  }
}

function playNow(id: SfxId): void {
  if (!prefs.sfx || AppState.currentState !== 'active') return;
  if (!gate(id, Date.now())) return;
  void load()
    .then((m) => {
      if (!m) return;
      const old = players.get(id);
      if (old) {
        // 끝난 소리는 처음으로 돌려야 다시 난다.
        void old
          .seekTo(0)
          .then(() => old.play())
          .catch(() => {});
        return;
      }
      const p = m.createAudioPlayer(SOURCES[id]);
      players.set(id, p);
      p.play();
    })
    .catch(() => {});
}
