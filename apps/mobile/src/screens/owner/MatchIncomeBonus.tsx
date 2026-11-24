// T-11-823 방금 건 랭크 경기의 수입을 한 번 더 받는 버튼(앱 전용). 광고를 끝까지 보면 받고, 광고 제거 · 멤버십은 바로 받는다.
// 경기마다 한 번이고 서버가 막는다(출석 '한 번 더 받기'와 같은 흐름 — 광고를 본 뒤 요청이 실패하면 다시 눌러 광고 없이 이어 받는다).
import { useEffect, useRef, useState } from 'react';
import { useSnapshot } from 'valtio';
import { claimMatchIncomeBonus } from '@offside/app-core/api/team';
import { fmtValue } from '@offside/app-core/format';
import { adText as AD } from '@offside/app-core/i18n/ko/ad';
import { toast } from '../../game/host';
import { adFree, adsOff } from '../../platform/adFree';
import { claimReward, prepareReward, rewardOffer } from '../../platform/rewarded';
import { playSfx } from '../../platform/sfx';
import { Btn } from '../../ui';

export function MatchIncomeBonus({ matchId }: { matchId: string }) {
  const offer = rewardOffer('income', adsOff(useSnapshot(adFree)));
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const earned = useRef(false);
  const key = useRef(crypto.randomUUID());
  const show = !!offer && !done;
  useEffect(() => {
    if (show) prepareReward('income');
  }, [show]);
  if (!show) return null;

  const claim = async () => {
    if (busy) return;
    setBusy(true);
    if (!earned.current) {
      const msg = await claimReward(
        'income',
        () => {
          earned.current = true;
        },
        AD.incomeWatch,
      );
      if (!earned.current) {
        setBusy(false);
        if (msg) toast(msg);
        return;
      }
    }
    const r = await claimMatchIncomeBonus(matchId, key.current);
    setBusy(false);
    if (!r.ok) {
      toast(AD.incomeFail);
      return;
    }
    setDone(true);
    if (r.data.taken) return;
    playSfx('reward');
    toast(AD.incomeGot({ amount: fmtValue(r.data.amount) }));
  };

  return (
    <Btn
      kind="accent"
      block
      disabled={busy}
      testID="match-income-bonus"
      onPress={() => void claim()}
    >
      {offer === 'free' ? AD.incomeFree : AD.incomeAd}
    </Btn>
  );
}
