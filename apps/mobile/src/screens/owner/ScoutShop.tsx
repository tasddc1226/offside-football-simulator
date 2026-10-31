// T-11-196 프리미엄 스카우트권 상점(웹 cup/ScoutShop.svelte) — 구단주 화면 잠재력 강화권 상점 아래. 펼치면 설명 · 스토어
// 묶음(IapPacks) · T-11-244 구단 자금으로 한 주 1장 · 확률 공개표를 보인다. 쓰는 곳은 선수 만들기 후보 단계다.
import { FONT } from '@offside/app-core/design-tokens';
import { useState } from 'react';
import { View } from 'react-native';
import { cupText as CL } from '@offside/app-core/i18n/ko/cup';
import { scoutText as L } from '@offside/app-core/i18n/ko/scout';
import { scoutWhatText } from '@offside/app-core/scoutOdds';
import { scoutPityAt } from '@offside/contracts/cup';
import { useIapItems } from '../../platform/iapItems';
import { rem } from '../../theme/type';
import { Card, Press, Txt } from '../../ui';
import { IapPacks } from './IapPacks';
import { ScoutFunds } from './ScoutFunds';
import { ScoutOdds } from './ScoutOdds';

export function ScoutShop({ onBought }: { onBought?: (balance: number, spent: number) => void }) {
  const [open, setOpen] = useState(false);
  const iap = useIapItems(true);
  const [funded, setFunded] = useState<number | null>(null);
  const have = funded ?? iap.items?.scout ?? 0;
  const small = { fontSize: rem(FONT.label) };
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
          <Txt tone="muted" style={{ fontSize: rem(FONT.body2) }} testID="scout-shop-sub">
            {have ? L.shopSubHave({ n: have }) : L.shopSub}
          </Txt>
        </View>
        <Txt
          tone="muted"
          style={{ fontSize: rem(FONT.title1), transform: [{ rotate: open ? '-90deg' : '90deg' }] }}
        >
          ›
        </Txt>
      </Press>
      {open ? (
        <>
          <Txt tone="muted" style={small}>
            {`${scoutWhatText()} ${L.pityHelp(scoutPityAt())}`}
          </Txt>
          {/* 묶음이 없으면 IapPacks는 '다시 확인' · 로그인 안내 · 받지 못한 결제만 보인다(T-11-434). */}
          <IapPacks item="scout" note={L.shopNote} />
          <ScoutFunds
            onBought={(n, balance, spent) => {
              setFunded(n);
              onBought?.(balance, spent);
            }}
          />
          <ScoutOdds />
        </>
      ) : null}
    </Card>
  );
}
