// T-11-196 프리미엄 스카우트권 상점(웹 cup/ScoutShop.svelte) — 구단주 화면 잠재력 강화권 상점 아래. 스토어 상품이 보이거나
// 가진 장수가 있을 때만 보인다. 펼치면 설명 · 스토어 묶음(IapPacks) · 확률 공개표를 보인다. 쓰는 곳은 선수 만들기 후보 단계다.
import { useState } from 'react';
import { View } from 'react-native';
import { cupText as CL } from '@offside/app-core/i18n/ko/cup';
import { scoutText as L } from '@offside/app-core/i18n/ko/scout';
import { sellablePacks, useIapItems } from '../../platform/iapItems';
import { rem } from '../../theme/type';
import { Card, Press, Txt } from '../../ui';
import { IapPacks } from './IapPacks';
import { ScoutOdds } from './ScoutOdds';

export function ScoutShop() {
  const [open, setOpen] = useState(false);
  const iap = useIapItems(true);
  const have = iap.items?.scout ?? 0;
  const sells = sellablePacks('scout', iap).length > 0;
  if (!sells && !have) return null;
  const small = { fontSize: rem(0.8125) };
  return (
    <Card gap={12} testID="scout-shop">
      <Press
        testID="scout-shop-toggle"
        accessibilityLabel={`${L.title} ${open ? CL.shopClose : CL.shopOpen}`}
        accessibilityState={{ expanded: open }}
        hitSlop={{ top: 18, left: 18, right: 18, bottom: open ? 6 : 18 }}
        onPress={() => setOpen((o) => !o)}
        scale={1}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
      >
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Txt v="eyebrow">Premium scout</Txt>
          <Txt v="h2">{L.title}</Txt>
          <Txt tone="muted" style={{ fontSize: rem(0.875) }} testID="scout-shop-sub">
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
        <>
          <Txt tone="muted" style={small}>
            {L.what}
          </Txt>
          {sells ? <IapPacks item="scout" note={L.shopNote} /> : null}
          <ScoutOdds />
        </>
      ) : null}
    </Card>
  );
}
