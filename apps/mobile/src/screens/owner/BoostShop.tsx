// T-11-178 잠재력 강화권 상점(웹 cup/BoostShop.svelte) — 구단주 화면 리롤권 상점 아래. 강화권은 스토어에서만 사서, 이 스토어
// 상품이 보이거나(광고 제거 구매자는 강화권이 필요 없어 빼고) 가진 강화권이 있을 때만 보인다. 접힌 카드에는 가진 장수만,
// 펼치면 스토어 묶음(IapPacks)을 보인다. 쓰는 곳은 선수 탭 잠재력 강화 카드다.
import { useState } from 'react';
import { View } from 'react-native';
import { useSnapshot } from 'valtio';
import { cupText as CL } from '@offside/app-core/i18n/ko/cup';
import { iapText as L } from '@offside/app-core/i18n/ko/iap';
import { adFree } from '../../platform/adFree';
import { sellablePacks, useIapItems } from '../../platform/iapItems';
import { rem } from '../../theme/type';
import { Card, Press, Txt } from '../../ui';
import { IapPacks } from './IapPacks';

export function BoostShop() {
  const [open, setOpen] = useState(false);
  const iap = useIapItems(true);
  const owned = useSnapshot(adFree).owned;
  const have = iap.items?.boost ?? 0;
  const sells = !owned && sellablePacks('boost', iap).length > 0;
  if (!sells && !have) return null;
  return (
    <Card gap={12} testID="boost-shop">
      <Press
        testID="boost-shop-toggle"
        accessibilityLabel={`${L.shopTitle} ${open ? CL.shopClose : CL.shopOpen}`}
        accessibilityState={{ expanded: open }}
        hitSlop={{ top: 18, left: 18, right: 18, bottom: open ? 6 : 18 }}
        onPress={() => setOpen((o) => !o)}
        scale={1}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
      >
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Txt v="eyebrow">Boost shop</Txt>
          <Txt v="h2">{L.shopTitle}</Txt>
          <Txt tone="muted" style={{ fontSize: rem(0.875) }} testID="boost-shop-sub">
            {have ? L.shopSubHave({ n: have }) : L.shopSub}
          </Txt>
        </View>
        <Txt
          tone="muted"
          style={{ fontSize: rem(1.5), transform: [{ rotate: open ? '-90deg' : '90deg' }] }}
        >
          ›
        </Txt>
      </Press>
      {open ? (
        sells ? (
          <IapPacks item="boost" note={L.shopNote} />
        ) : (
          <Txt tone="muted" style={{ fontSize: rem(0.8125) }}>
            {L.shopNote}
          </Txt>
        )
      ) : null}
    </Card>
  );
}
