import { useEffect, useRef, useState } from 'react';
import type { Candidate } from '@offside/game/candidates';
import type { Pos } from '@offside/game/data';
import { startOvr } from '@offside/app-core/create-view';
import {
  candidateTiers,
  revealTiming,
  revealTotal,
  type RevealTier,
  type RevealTiming,
} from '@offside/app-core/reveal';
import { flashEdge, revealBuzz } from '../../components/RevealFx';
import { appState, prefs } from '../../store';

type RevealCandidate = Pick<Candidate, 'attrs' | 'guaranteed' | 'pity'>;
/** Per-screen card timing. Candidate selection and reward claiming remain with the caller. */
export function useCandidateReveal(
  candidates: readonly RevealCandidate[] | null,
  pos: Pos,
  potentialOpen: boolean,
) {
  const tiers: RevealTier[] = candidates
    ? candidateTiers(
        candidates.map((c) => ({
          ovr: startOvr(pos, c.attrs),
          guaranteed: c.guaranteed,
          pity: c.pity,
        })),
      )
    : [];
  const [fx, setFx] = useState<Record<number, RevealTiming & { done: boolean }>>({});
  const opened = useRef(0);
  const fxTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    // 다시 뽑기 · 프리미엄 스카우트로 후보가 바뀌면 새 카드로 다시 센다.
    setFx({});
    opened.current = 0;
  }, [candidates]);
  useEffect(() => () => fxTimers.current.forEach(clearTimeout), []);
  const land = (i: number) =>
    setFx((m) => {
      const f = m[i];
      if (!f || f.done) return m;
      const tier = tiers[i] ?? 'normal';
      revealBuzz(tier);
      if (tier === 'jackpot') flashEdge();
      return { ...m, [i]: { ...f, done: true } };
    });
  const stage = (i: number) => {
    if (appState.candidatesOpen[i] || fx[i]) return;
    const tier = tiers[i] ?? 'normal';
    const t = revealTiming(tier, {
      off: !prefs.motionOK,
      short: prefs.revealShort,
      repeat: opened.current++ > 0,
    });
    const total = revealTotal(t);
    if (total === 0) revealBuzz(tier);
    else fxTimers.current.push(setTimeout(() => land(i), total));
    setFx((m) => ({ ...m, [i]: { ...t, done: total === 0 } }));
  };
  // 잠재력 범위를 이 화면에서 새로 열었을 때만 등급 연출.
  const potWas = useRef(potentialOpen);
  const [potFresh, setPotFresh] = useState(false);
  useEffect(() => {
    if (potentialOpen && !potWas.current) setPotFresh(true);
    potWas.current = potentialOpen;
  }, [potentialOpen]);
  return { tiers, fx, land, stage, potFresh };
}
