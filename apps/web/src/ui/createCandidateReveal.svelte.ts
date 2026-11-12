import {
  candidateTiers,
  revealTiming,
  revealTotal,
  REVEAL_BUZZ,
  type RevealTier,
} from '@offside/app-core/reveal';
import { startOvr } from '@offside/app-core/create-view';
import type { DraftCharacter } from '@offside/app-core/state';
import { appState } from './state.svelte.js';
import { buzz, motionOK } from './motion.js';
import { sheetOn } from './skin.svelte.js';
import { flashEdge, revealShort, revealTone } from './revealPrefs.js';

/** Per-screen card timing. Candidate selection and reward claiming remain with the caller. */
export function createCandidateReveal(C: Pick<DraftCharacter, 'pos'>) {
  const tiers = $derived<RevealTier[]>(
    appState.candidates
      ? candidateTiers(
          appState.candidates.map((c) => ({
            ovr: startOvr(C.pos, c.attrs),
            guaranteed: c.guaranteed,
            pity: c.pity,
          })),
        )
      : [],
  );
  const fxOff = !motionOK || sheetOn() || revealShort();
  // 카드 번호 → 이번에 열며 볼 연출(뒷면 · 단서 · 멈춤 시간). 화면에 처음 들어올 때 이미 열린 카드는 연출하지 않는다.
  const state = $state({
    fx: {} as Record<number, { back: number; hint: number; hold: number; done: boolean }>,
    potFresh: false,
  });
  let opened = 0;
  // 다시 뽑기 · 프리미엄 스카우트로 후보가 바뀌면 새 카드로 다시 센다.
  $effect(() => {
    void appState.candidates;
    state.fx = {};
    opened = 0;
  });
  function stage(i: number) {
    if (appState.candidatesOpen[i] || state.fx[i]) return;
    const t = revealTiming(tiers[i] ?? 'normal', { off: fxOff, repeat: opened++ > 0 });
    state.fx[i] = { ...t, done: revealTotal(t) === 0 };
    if (state.fx[i].done) return land(i);
    setTimeout(() => land(i), revealTotal(t));
  }
  function land(i: number) {
    const f = state.fx[i];
    if (!f || (f.done && revealTotal(f) > 0)) return;
    f.done = true;
    const tier = tiers[i] ?? 'normal';
    buzz(REVEAL_BUZZ[tier]);
    revealTone(tier);
    if (tier === 'jackpot' && revealTotal(f) > 0) flashEdge();
  }
  // 잠재력 범위를 이 화면에서 새로 열었을 때만 등급 연출(다시 들어온 화면 · 킵하며 이미 본 후보는 그대로).
  let potWas = appState.candidatePotentialOpen;
  $effect(() => {
    const open = appState.candidatePotentialOpen;
    if (open && !potWas) state.potFresh = true;
    potWas = open;
  });
  return {
    state,
    get tiers() {
      return tiers;
    },
    fxOff,
    stage,
    land,
  };
}
