// T-11-377 선수 이름 변경권(웹 cup/RenameShop.svelte) — 구단주 화면 강화권 상점 아래. 변경권은 스토어에서 사거나 출석 28일째에
// 받는다. 이 스토어 상품이 보이거나 가진 변경권이 있을 때만 보인다. 접힌 카드에는 가진 장수만, 펼치면 스토어 묶음(IapPacks)과
// 쓰는 곳을 보인다.
import { useState } from 'react';
import { View } from 'react-native';
import { cupText as CL } from '@offside/app-core/i18n/ko/cup';
import { renameText as L } from '@offside/app-core/i18n/ko/rename';
import { sellablePacks, useIapItems } from '../../platform/iapItems';
import { rem } from '../../theme/type';
import { Card, Press, Txt } from '../../ui';
import { IapPacks } from './IapPacks';

export function RenameShop() {
  const [open, setOpen] = useState(false);
  const iap = useIapItems(true);
  const have = iap.items?.rename ?? 0;
  const sells = sellablePacks('rename', iap).length > 0;
  if (!sells && !have) return null;
  return (
    <Card gap={12} testID="rename-shop">
      <Press
        testID="rename-shop-toggle"
        accessibilityLabel={`${L.shopTitle} ${open ? CL.shopClose : CL.shopOpen}`}
        accessibilityState={{ expanded: open }}
        hitSlop={{ top: 18, left: 18, right: 18, bottom: open ? 6 : 18 }}
        onPress={() => setOpen((o) => !o)}
        scale={1}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
      >
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Txt v="eyebrow">Rename</Txt>
          <Txt v="h2">{L.shopTitle}</Txt>
          <Txt tone="muted" style={{ fontSize: rem(0.875) }} testID="rename-shop-sub">
            {L.shopHave({ n: have })}
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
          <IapPacks item="rename" note={L.shopNote} />
        ) : (
          <Txt tone="muted" style={{ fontSize: rem(0.8125) }}>
            {L.shopNote}
          </Txt>
        )
      ) : null}
    </Card>
  );
}
