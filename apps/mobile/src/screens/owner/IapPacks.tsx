// T-11-174 스토어에서 사는 아이템 묶음(리롤권 · 잠재력 강화권). 서버가 이 스토어 구매를 확인할 수 있고 스토어가 가격을 알려 준
// 상품만 보인다. 결과(받은 장수)는 platform/iapItems.ts가 토스트로 알린다.
import { View } from 'react-native';
import { IAP_PRODUCT_IDS, IAP_PRODUCTS, type OwnerItem } from '@offside/contracts/cup';
import { iapText as L } from '@offside/app-core/i18n/ko/iap';
import { buyIapItem, useIapItems } from '../../platform/iapItems';
import { rem } from '../../theme/type';
import { Btn, Txt } from '../../ui';

export function IapPacks({ item, note }: { item: OwnerItem; note?: string }) {
  const iap = useIapItems(true);
  const packs = IAP_PRODUCT_IDS.filter((id) => IAP_PRODUCTS[id].item === item && iap.prices[id]);
  if (!iap.open || !packs.length) return null;
  return (
    <View style={{ gap: 8 }} testID={`iap-${item}`}>
      <Txt v="eyebrow">{L.packsTitle}</Txt>
      {packs.map((id) => {
        const n = IAP_PRODUCTS[id].qty;
        return (
          <Btn
            key={id}
            block
            disabled={!!iap.busy}
            testID={`iap-buy-${id}`}
            onPress={() => void buyIapItem(id)}
          >
            {iap.busy === id
              ? L.busy
              : `${item === 'boost' ? L.boostPack({ n }) : L.rerollPack({ n })} · ${iap.prices[id]}`}
          </Btn>
        );
      })}
      {note ? (
        <Txt tone="muted" style={{ fontSize: rem(0.8125) }}>
          {note}
        </Txt>
      ) : null}
    </View>
  );
}
