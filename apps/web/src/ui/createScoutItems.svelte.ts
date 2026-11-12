import { createScoutAttempts } from '@offside/app-core/scoutAttempts';
import { fetchItems, spendReroll, spendScout } from '@offside/app-core/api/cup';
import { hasSessionHint } from '@offside/app-core/api/client';
import {
  EMPTY_SCOUT_PITY as NO_PITY,
  scoutItemsView,
  scoutUseFeedback,
  rerollUseFeedback,
} from '@offside/app-core/scoutItemsView';
import type { ScoutPity } from '@offside/contracts/cup';
import { scoutText as SL } from '@offside/app-core/i18n/ko/scout';
import { cupText as CL } from '@offside/app-core/i18n/ko/cup';
import { planPremiumScout, premiumScoutCandidates, rerollCandidates } from './actions.js';
import { toast } from './helpers.js';

/** Same web request trigger, confirmation timing and per-attempt retry identities. */
export function createScoutItems(hasCandidates: () => boolean) {
  const state = $state({
    rerolls: 0,
    owner: false,
    rerolling: false,
    mileage: 0,
    scouts: 0,
    scoutBusy: false,
    pity: NO_PITY as ScoutPity,
  });
  // T-11-152 장수를 받았으면(로그인한 구단주) 0장일 때 구단 자금으로 사는 리롤권 상점으로 가는 안내를 보인다.
  // 한 번의 '다시 뽑기' 시도에 멱등 키 하나 — 응답을 못 받아(네트워크) 다시 누르면 같은 키로 보내 두 번 차감되지 않는다.
  const attempts = createScoutAttempts(planPremiumScout);
  // T-11-248 리롤권 마일리지 — 마지막 스카우트권 지급 뒤 쓴 장수. 차면 서버가 같은 응답에서 스카우트권을 준다.
  $effect(() => {
    if (!hasCandidates() || !hasSessionHint()) return;
    void fetchItems().then((r) => {
      const next = scoutItemsView(r);
      state.owner = next.owner;
      state.rerolls = next.rerolls;
      state.scouts = next.scouts;
      state.pity = next.pity;
      state.mileage = next.mileage;
    });
  });
  // T-11-196 프리미엄 스카우트권 — 가진 장수가 있을 때만 버튼을 보인다(웹은 스토어 결제가 없다). 멱등 키는 리롤권과 같다.
  // 재시도 키와 시드 계획은 scoutAttempts가 함께 유지한다.
  async function premiumScout() {
    if (state.scoutBusy || state.scouts < 1 || !confirm(SL.confirm({ n: state.scouts - 1 })))
      return;
    state.scoutBusy = true;
    const { key, plan } = attempts.forScout();
    const r = await spendScout(key, plan.hit);
    state.scoutBusy = false;
    attempts.settleScout(r);
    if (!r.ok) {
      if (r.error.reason === 'NO_SCOUT') state.scouts = 0;
      return toast(r.error.message || SL.fail);
    }
    state.scouts = r.data.scout;
    if (r.data.pity) state.pity = r.data.pity;
    const mode = r.data.scoutMode ?? 'normal';
    premiumScoutCandidates(plan.seed, mode);
    toast(scoutUseFeedback(r.data));
  }
  async function reroll() {
    if (
      state.rerolling ||
      state.rerolls < 1 ||
      !confirm(CL.rerollConfirm({ n: state.rerolls - 1 }))
    )
      return;
    state.rerolling = true;
    const r = await spendReroll(attempts.forReroll());
    state.rerolling = false;
    attempts.settleReroll(r);
    if (!r.ok) {
      if (r.error.reason === 'NO_REROLL') state.rerolls = 0;
      return toast(r.error.message || CL.rerollFail);
    }
    state.rerolls = r.data.reroll;
    state.scouts = r.data.scout;
    state.mileage = r.data.mileage ?? 0;
    rerollCandidates();
    toast(rerollUseFeedback(r.data));
  }
  return { state, reroll, premiumScout };
}
