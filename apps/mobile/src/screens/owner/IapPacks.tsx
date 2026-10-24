// T-11-174 스토어에서 사는 아이템 묶음(리롤권 · 잠재력 강화권 · T-11-196 프리미엄 스카우트권). 서버가 이 스토어 구매를 확인할 수 있고 스토어가 가격을 알려 준
// 상품만 보인다. 결과(받은 장수)는 platform/iapItems.ts가 토스트로 알린다.
import { FONT } from '@offside/app-core/design-tokens';
import { View } from 'react-native';
import { IAP_PRODUCTS, type OwnerItem } from '@offside/contracts/cup';
import { iapText as L } from '@offside/app-core/i18n/ko/iap';
import { scoutText as SL } from '@offside/app-core/i18n/ko/scout';
import {
  buyIapItem,
  retryIapClaims,
  retryIapItems,
  sellablePacks,
  useIapItems,
} from '../../platform/iapItems';
import { rem } from '../../theme/type';
import { Btn, Txt } from '../../ui';
import { LoginButtons } from './LoginButtons';

const PACK = {
  reroll: L.rerollPack,
  boost: L.boostPack,
  scout: SL.pack,
  rename: L.renamePack,
} as const;

/**
 * login: 로그인 전일 때 안내 줄 아래 로그인 버튼까지 보일지(구단주 화면 상점은 보이고, 경기 화면 선수 탭은 안내 줄만).
 * T-11-434 상품을 못 불러왔으면 '다시 확인', 로그인 전이면 로그인 안내, 받지 못한 결제가 남았으면 '지급 다시 확인'을 보인다.
 */
export function IapPacks({
  item,
  note,
  login = true,
}: {
  item: OwnerItem;
  note?: string;
  login?: boolean;
}) {
  const iap = useIapItems(true);
  const packs = sellablePacks(item, iap);
  const small = { fontSize: rem(FONT.label) };
  const claim = iap.claimLeft ? (
    <View style={{ gap: 6 }} testID="iap-claim-left">
      <Txt tone="muted" style={small}>
        {L.claimLeft}
      </Txt>
      <Btn
        block
        disabled={iap.claiming}
        testID="iap-claim-retry"
        onPress={() => void retryIapClaims()}
      >
        {iap.claiming ? L.loading : L.claimRetry}
      </Btn>
    </View>
  ) : null;
  if (!packs.length) {
    if (iap.status === 'failed')
      return (
        <View style={{ gap: 6 }} testID={`iap-${item}-fail`}>
          <Txt tone="muted" style={small} accessibilityRole="alert">
            {L.loadFail}
          </Txt>
          <Btn
            block
            disabled={iap.checking}
            testID="iap-retry"
            onPress={() => void retryIapItems()}
          >
            {iap.checking ? L.loading : L.retry}
          </Btn>
          {claim}
        </View>
      );
    if (iap.status === 'login')
      return (
        <View style={{ gap: 6 }} testID={`iap-${item}-login`}>
          <Txt tone="muted" style={small}>
            {L.loginHint}
          </Txt>
          {login ? <LoginButtons /> : null}
        </View>
      );
    return claim;
  }
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
            {iap.busy === id ? L.busy : `${PACK[item]({ n })} · ${iap.prices[id]}`}
          </Btn>
        );
      })}
      {note ? (
        <Txt tone="muted" style={small}>
          {note}
        </Txt>
      ) : null}
      {claim}
    </View>
  );
}
