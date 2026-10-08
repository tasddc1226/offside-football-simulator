// T-11-152 리롤권 상점(웹 cup/RerollShop.svelte) — 구단주 화면에서 구단 자금으로 선수 후보 리롤권을 산다. 펼칠 때만 상점을
// 묻고(30초 메모), 사면 서버가 돌려준 상점 값으로 바꾼 뒤 onBought로 구단주 화면의 자금 줄을 새 잔액으로 고친다. 접힌 카드에는
// 가진 장수만 보이고(후보 화면과 같은 30초 메모), focus면(후보 화면 '리롤권 상점 가기') 펼친 채로 열고 카드로 내려간다.
import { useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import {
  buyReroll,
  fetchItems,
  fetchRerollShop,
  type RerollShopResponse,
} from '@offside/app-core/api/cup';
import { cupText as L } from '@offside/app-core/i18n/ko/cup';
import { cupAppText as CA } from '@offside/app-core/i18n/ko/cupApp';
import { fundsText } from '@offside/app-core/market';
import { rerollShopState } from '@offside/app-core/rerollShop';
import { toast } from '../../game/host';
import { prefs } from '../../store';
import { useColors } from '../../theme/useColors';
import { num, rem } from '../../theme/type';
import { scrollToView } from '../../ui/scroll';
import { Btn, Card, Press, Txt } from '../../ui';

export function RerollShop({
  onBought,
  focus = false,
}: {
  onBought?: (balance: number, spent: number) => void;
  focus?: boolean;
}) {
  const c = useColors();
  const [open, setOpen] = useState(focus);
  const [have, setHave] = useState<number | null>(null);
  const box = useRef<View>(null);
  const scrolled = useRef(!focus);
  const [shop, setShop] = useState<RerollShopResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  // 한 번의 '사기' 시도에 멱등 키 하나 — 응답을 못 받아(네트워크) 다시 누르면 같은 키로 보내 두 장을 사지 않는다.
  const buyKey = useRef<string | null>(null);
  const view = shop ? rerollShopState(shop) : null;

  async function load() {
    const r = await fetchRerollShop();
    setFailed(!r.ok);
    if (r.ok) {
      setShop(r.data);
      setHave(r.data.reroll);
    }
  }
  useEffect(() => {
    let alive = true;
    // 펼친 채로 열면 상점 응답에 가진 장수가 있어 따로 묻지 않는다.
    if (focus) void load();
    else void fetchItems().then((r) => alive && r.ok && setHave((h) => h ?? r.data.reroll));
    return () => {
      alive = false;
    };
    // 처음 그릴 때 한 번만 묻는다.
  }, []);
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
      const r = await buyReroll(price, buyKey.current);
      if (r.ok || !r.error.retryable) buyKey.current = null;
      if (!r.ok) {
        // 다시 해도 안 되는 거절(가격이 바뀜 · 상한 · 자금 부족)이면 상점 값을 다시 받는다.
        if (!r.error.retryable) void load();
        toast(r.error.message || L.shopFail);
        return;
      }
      setShop(r.data);
      setHave(r.data.reroll);
      toast(L.shopDone({ n: r.data.reroll }));
      onBought?.(r.data.balance, price);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const ask = () => {
    if (!shop || shop.price === null) return;
    const price = shop.price;
    Alert.alert(
      CA.shopAskTitle,
      L.shopConfirm({ price: fundsText(price), balance: fundsText(shop.balance - price) }),
      [
        { text: CA.cancel, style: 'cancel' },
        { text: CA.shopAction, onPress: () => void buy(price) },
      ],
    );
  };
  const small = { fontSize: rem(0.875) } as const;

  return (
    <View
      ref={box}
      onLayout={() => {
        if (scrolled.current) return;
        scrolled.current = true;
        scrollToView(box.current, prefs.motionOK);
      }}
    >
      <Card gap={12} testID="reroll-shop">
        {/* 머리 줄 전체가 펼치기 버튼(웹은 카드 위쪽을 덮는다). 누르는 자리는 카드 가장자리까지 넓힌다. */}
        <Press
          testID="reroll-shop-toggle"
          accessibilityLabel={`${L.shopTitle} ${open ? L.shopClose : L.shopOpen}`}
          accessibilityState={{ expanded: open }}
          hitSlop={{ top: 18, left: 18, right: 18, bottom: open ? 6 : 18 }}
          onPress={toggle}
          scale={1}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
        >
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Txt v="eyebrow">Reroll shop</Txt>
            <Txt v="h2">{L.shopTitle}</Txt>
            <Txt tone="muted" style={small} testID="reroll-sub">
              {have === null ? L.shopSub : L.shopSubHave({ n: have })}
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
          shop && view ? (
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {[
                  L.shopHave({ n: shop.reroll }),
                  L.shopFunds({ funds: fundsText(shop.balance) }),
                  L.shopToday({ bought: shop.bought, cap: shop.cap }),
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
                  {L.shopClosed}
                </Txt>
              ) : view === 'soldOut' ? (
                <Txt tone="muted" style={small} testID="reroll-soldout">
                  {L.shopSoldOut}
                </Txt>
              ) : (
                <>
                  <Txt style={{ ...num(700), fontSize: rem(1.125) }} testID="reroll-price">
                    {L.shopPrice({ price: fundsText(shop.price!) })}
                  </Txt>
                  {view === 'short' ? (
                    <Txt tone="muted" style={small}>
                      {L.shopShort}
                    </Txt>
                  ) : null}
                  <Btn
                    kind="primary"
                    block
                    testID="reroll-buy"
                    disabled={busy || view === 'short'}
                    onPress={ask}
                  >
                    {busy ? L.shopBusy : L.shopBuy({ price: fundsText(shop.price!) })}
                  </Btn>
                </>
              )}
              <Txt tone="muted" style={small}>
                {L.shopNote}
              </Txt>
            </View>
          ) : (
            <Txt tone="muted" style={small}>
              {failed ? L.shopLoadFail : '…'}
            </Txt>
          )
        ) : null}
      </Card>
    </View>
  );
}
