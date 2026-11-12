import { createScoutAttempts } from '@offside/app-core/scoutAttempts';
import { useEffect, useRef, useState } from 'react';
import { fetchItems, spendReroll, spendScout } from '@offside/app-core/api/cup';
import {
  EMPTY_SCOUT_PITY as NO_PITY,
  scoutItemsView,
  scoutUseFeedback,
  rerollUseFeedback,
} from '@offside/app-core/scoutItemsView';
import type { ScoutPity } from '@offside/contracts/cup';
import { scoutText as SL } from '@offside/app-core/i18n/ko/scout';
import { cupText as CL } from '@offside/app-core/i18n/ko/cup';
import { planPremiumScout, premiumScoutCandidates, rerollCandidates, toast } from '../../game/host';

/** Item spending and retry identity; the ad adapter shares the same rerollLock. */
export function useScoutItems(hasCandidates: boolean, onUsed: () => void) {
  const [rerolls, setRerolls] = useState(0);
  // T-11-152 장수를 받았으면(로그인한 구단주) 0장일 때 구단 자금으로 사는 리롤권 상점으로 가는 안내를 보인다.
  const [owner, setOwner] = useState(false);
  const [rerolling, setRerolling] = useState(false);
  const rerollLock = useRef(false);
  // 한 번의 '다시 뽑기' 시도에 멱등 키 하나 — 응답을 못 받아(네트워크) 다시 누르면 같은 키로 보내 두 번 차감되지 않는다.
  const [attempts] = useState(() => createScoutAttempts(planPremiumScout));
  // T-11-248 리롤권 마일리지 — 마지막 스카우트권 지급 뒤 쓴 장수. 차면 서버가 같은 응답에서 스카우트권을 준다.
  const [mileage, setMileage] = useState(0);
  // T-11-196 프리미엄 스카우트권 — 가진 장수가 있으면 버튼, 없으면 구단주에게 상점(구단주 화면)으로 가는 안내. 잠금 · 멱등 키는 리롤과 함께 쓴다.
  const [scouts, setScouts] = useState(0);
  // T-11-244 천장 카운트. 다시 보낼 때는 같은 시드 계획을 같은 멱등 키와 함께 쓴다.
  const [pity, setPity] = useState<ScoutPity>(NO_PITY);
  // T-11-437 쓸 도구(리롤권 · 스카우트권 · 천장 기록)가 없으면 상점 안내 · 능력치 설명을 '더 보기'로 접는다.
  useEffect(() => {
    if (!hasCandidates) return;
    let live = true;
    void fetchItems().then((r) => {
      if (!live) return;
      const next = scoutItemsView(r);
      setOwner(next.owner);
      setRerolls(next.rerolls);
      setScouts(next.scouts);
      setPity(next.pity);
      setMileage(next.mileage);
    });
    return () => {
      live = false;
    };
  }, [hasCandidates]);
  async function reroll() {
    if (rerollLock.current || rerolls < 1) return;
    rerollLock.current = true;
    setRerolling(true);
    try {
      const r = await spendReroll(attempts.forReroll());
      attempts.settleReroll(r);
      if (!r.ok) {
        if (r.error.reason === 'NO_REROLL') setRerolls(0);
        toast(r.error.message || CL.rerollFail);
        return;
      }
      setRerolls(r.data.reroll);
      setScouts(r.data.scout);
      setMileage(r.data.mileage ?? 0);
      rerollCandidates();
      onUsed();
      toast(rerollUseFeedback(r.data));
    } finally {
      rerollLock.current = false;
      setRerolling(false);
    }
  }
  async function premiumScout() {
    if (rerollLock.current || scouts < 1) return;
    rerollLock.current = true;
    setRerolling(true);
    try {
      const { key, plan } = attempts.forScout();
      const r = await spendScout(key, plan.hit);
      attempts.settleScout(r);
      if (!r.ok) {
        if (r.error.reason === 'NO_SCOUT') setScouts(0);
        toast(r.error.message || SL.fail);
        return;
      }
      setScouts(r.data.scout);
      if (r.data.pity) setPity(r.data.pity);
      const mode = r.data.scoutMode ?? 'normal';
      premiumScoutCandidates(plan.seed, mode);
      onUsed();
      toast(scoutUseFeedback(r.data));
    } finally {
      rerollLock.current = false;
      setRerolling(false);
    }
  }
  return {
    rerolls,
    owner,
    rerolling,
    setRerolling,
    rerollLock,
    mileage,
    scouts,
    pity,
    reroll,
    premiumScout,
  };
}
