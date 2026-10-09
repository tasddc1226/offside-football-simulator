// T-11-153 광고 대신 구단 자금으로 받기(app-core club-reward)의 앱 쪽. want일 때만 값을 받고(30초 메모라 여러 자리가 같이
// 불러도 요청은 하나), pay는 확인 창을 띄운 뒤 구단 자금을 쓰고 grant로 보상을 준다. 취소하면 null, 아니면 보여 줄 안내.
import { useEffect, useState } from 'react';
import type { RewardKind, RewardShopResponse } from '@offside/contracts';
import { clubOffer, loadClubShop, payWithClub } from '@offside/app-core/club-reward';
import { gameBoostText as B } from '@offside/app-core/i18n/ko/gameBoost';
import { confirmAsync } from '../screens/board/parts';

export function useClubReward(kind: RewardKind, want: boolean) {
  const [shop, setShop] = useState<RewardShopResponse | null>(null);
  useEffect(() => {
    if (!want) return;
    let live = true;
    void loadClubShop().then((r) => live && setShop(r));
    return () => {
      live = false;
    };
  }, [want]);
  const offer = want ? clubOffer(shop, kind) : null;
  async function pay(grant: () => void): Promise<string | null> {
    if (!offer) return null;
    const r = await payWithClub(offer, (m) => confirmAsync(B.clubAskTitle, m, B.clubAction), grant);
    if (!r) return null;
    if (r.shop) setShop(r.shop);
    return r.message;
  }
  return { offer, pay, shop: want ? shop : null };
}
