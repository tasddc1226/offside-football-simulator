// T-11-244 프리미엄 스카우트권을 구단 자금으로 사기(한 주 상한, 웹 cup/ScoutFunds.svelte). 누를 때만 상점 값을 묻고(리롤권
// 상점과 같은 30초 메모), 사면 서버가 돌려준 값으로 바꾼다. onBought로 가진 장수와 구단주 화면의 자금 줄을 고친다.
import { useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import {
  buyScoutWithFunds,
  fetchRerollShop,
  type RerollShopResponse,
} from '@offside/app-core/api/cup';
import { cupText as CL } from '@offside/app-core/i18n/ko/cup';
import { cupAppText as CA } from '@offside/app-core/i18n/ko/cupApp';
import { scoutText as L } from '@offside/app-core/i18n/ko/scout';
import { fundsText } from '@offside/app-core/market';
import { scoutShopState } from '@offside/app-core/rerollShop';
import { toast } from '../../game/host';
import { useColors } from '../../theme/useColors';
import { rem } from '../../theme/type';
import { Btn, Txt } from '../../ui';

export function ScoutFunds({
  onBought,
}: {
  onBought?: (have: number, balance: number, spent: number) => void;
}) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const [shop, setShop] = useState<RerollShopResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const buyKey = useRef<string | null>(null);
  const view = shop ? scoutShopState(shop) : null;
  const small = { fontSize: rem(0.875) } as const;

  async function load() {
    const r = await fetchRerollShop();
    setFailed(!r.ok);
    if (r.ok) setShop(r.data);
  }
  function toggle() {
    setOpen((o) => !o);
    if (!open && !shop) void load();
  }
  async function buy(price: number) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      buyKey.current ??= crypto.randomUUID();
      const r = await buyScoutWithFunds(price, buyKey.current);
      if (r.ok || !r.error.retryable) buyKey.current = null;
      if (!r.ok) {
        if (!r.error.retryable) void load();
        toast(r.error.message || L.fundsFail);
        return;
      }
      setShop(r.data);
      const have = r.data.scout?.have ?? 0;
      toast(L.fundsDone({ n: have }));
      onBought?.(have, r.data.balance, price);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const ask = () => {
    const price = shop?.scout?.price;
    if (!shop || !price) return;
    Alert.alert(
      L.funds,
      L.fundsConfirm({ price: fundsText(price), balance: fundsText(shop.balance - price) }),
      [
        { text: CA.cancel, style: 'cancel' },
        { text: CA.shopAction, onPress: () => void buy(price) },
      ],
    );
  };

  return (
    <View style={{ gap: 10 }}>
      <Btn sm kind="ghost" testID="scout-funds" onPress={toggle}>
        {L.funds}
      </Btn>
      {open ? (
        shop && view && shop.scout ? (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {[
                CL.shopFunds({ funds: fundsText(shop.balance) }),
                L.fundsWeek({ bought: shop.scout.bought, cap: shop.scout.cap }),
              ].map((t) => (
                <View
                  key={t}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 10,
                    backgroundColor: c.surface2,
                  }}
                >
                  <Txt style={{ fontSize: rem(0.8125), fontVariant: ['tabular-nums'] }}>{t}</Txt>
                </View>
              ))}
            </View>
            {view === 'closed' ? (
              <Txt tone="muted" style={small}>
                {L.fundsClosed}
              </Txt>
            ) : view === 'soldOut' ? (
              <Txt tone="muted" style={small} testID="scout-funds-soldout">
                {L.fundsSoldOut}
              </Txt>
            ) : (
              <>
                {view === 'short' ? (
                  <Txt tone="muted" style={small}>
                    {CL.shopShort}
                  </Txt>
                ) : null}
                <Btn
                  kind="primary"
                  block
                  testID="scout-funds-buy"
                  disabled={busy || view === 'short'}
                  onPress={ask}
                >
                  {busy ? CL.shopBusy : CL.shopBuy({ price: fundsText(shop.scout.price!) })}
                </Btn>
              </>
            )}
            <Txt tone="muted" style={small}>
              {L.fundsNote}
            </Txt>
          </>
        ) : (
          <Txt tone="muted" style={small}>
            {failed ? CL.shopLoadFail : '…'}
          </Txt>
        )
      ) : null}
    </View>
  );
}
