// T-11-567 상점(웹 Shop.svelte) — 구단주 화면의 '상점' 칸으로 연다. 예전에는 구단주 화면에 상점 넷이 줄줄이 펼쳐져 있었다.
// 맨 위 자금 줄은 구단주 · 이적시장과 같은 응답(1분 메모)이라 다시 묻지 않고, 사면 상점이 돌려준 잔액으로 고친다.
import { FONT } from '@offside/app-core/design-tokens';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSnapshot } from 'valtio';
import { fetchMarketFunds, type MarketFundsResponse } from '@offside/app-core/api/market';
import { fundsText } from '@offside/app-core/market';
import { isMember } from '@offside/app-core/account';
import { ownerText as L } from '@offside/app-core/i18n/ko/owner';
import { fundsHistoryText as F } from '@offside/app-core/i18n/ko/fundsHistory';
import { ensureAccount } from '../../game/host';
import { accountCache } from '../../store';
import { go, takeFocus } from '../../game/nav';
import { DISPLAY, rem } from '../../theme/type';
import { Card, Press, Screen, Topbar, Txt } from '../../ui';
import { useRefresh } from '../../ui/refresh';
import { BoostShop } from './BoostShop';
import { LoginButtons } from './LoginButtons';
import { RenameShop } from './RenameShop';
import { RerollShop } from './RerollShop';
import { ScoutShop } from './ScoutShop';

export default function Shop() {
  const cache = useSnapshot(accountCache);
  // T-11-567 계정 카드가 설정으로 옮겨 가서, 로그인 여부는 이 화면이 직접 확인한다(5분 메모).
  useEffect(ensureAccount, []);
  const acct = cache.value;
  const linked = !!acct && acct !== 'error' && isMember(acct);
  const guest = acct === null || (!!acct && acct !== 'error' && !isMember(acct));
  // T-11-152 후보 화면 '리롤권 상점 가기'로 들어왔으면 리롤권 상점을 펼친 채로 연다(한 번만 읽힌다).
  const [shopFocus] = useState(() => takeFocus('rerollShop'));
  const { tick, track } = useRefresh();
  const [market, setMarket] = useState<MarketFundsResponse | null>(null);
  useEffect(() => {
    if (!linked) return;
    let alive = true;
    void track(fetchMarketFunds()).then((r) => alive && r.ok && setMarket(r.data));
    return () => {
      alive = false;
    };
  }, [linked, tick, track]);
  const bought = (balance: number, spent: number) =>
    setMarket((m) => m && { balance, clubValue: m.clubValue - spent });

  return (
    <Screen>
      <Topbar />
      <View style={{ paddingHorizontal: 2, paddingTop: 4 }}>
        <Txt v="eyebrow">Shop</Txt>
        <Txt v="h1" accessibilityRole="header" style={{ marginTop: 2 }}>
          {L.shopTitle}
        </Txt>
      </View>
      {linked ? (
        <>
          <Press
            testID="shop-funds"
            accessibilityLabel={F.openAria}
            onPress={() => go('funds')}
            scale={0.98}
          >
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Txt tone="muted" style={{ fontSize: rem(FONT.body2) }}>
                  {L.statFunds}
                </Txt>
                <Txt
                  testID="shop-funds-value"
                  style={{
                    flex: 1,
                    fontFamily: DISPLAY[700],
                    fontSize: rem(FONT.title3),
                  }}
                >
                  {market ? fundsText(market.balance) : '–'}
                </Txt>
                <Txt tone="muted" style={{ fontSize: rem(FONT.title2) }}>
                  ›
                </Txt>
              </View>
            </Card>
          </Press>
          <RerollShop focus={shopFocus} onBought={bought} />
          <BoostShop />
          <RenameShop />
          <ScoutShop onBought={bought} />
        </>
      ) : guest ? (
        <Card gap={12} testID="shop-guest">
          <Txt tone="muted">{L.shopLoginNeeded}</Txt>
          <LoginButtons />
        </Card>
      ) : null}
    </Screen>
  );
}
