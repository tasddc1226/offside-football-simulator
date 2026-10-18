// T-11-275 홈의 구단주 선물(웹 HomeGift.svelte) — 오프사이드 컵 배너 바로 아래. 로그인한 구단주가 한 번 받으면 사라진다.
// 묻는 조건 · 메모는 app-core api/gift.ts.
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useSnapshot } from 'valtio';
import {
  claimHomeGift,
  fetchHomeGift,
  giftCopy,
  type HomeGift as Gift,
} from '@offside/app-core/api/gift';
import { giftText as L } from '@offside/app-core/i18n/ko/gift';
import { toast } from '../../game/host';
import { notificationDestination } from '../../platform/notificationDestination';
import { alpha } from '../../theme/colors';
import { useColors } from '../../theme/useColors';
import { Btn, Card, Txt } from '../../ui';
import { useOnPull } from '../../ui/refresh';

export function HomeGift() {
  const c = useColors();
  const [gift, setGift] = useState<Gift | null>(null);
  const [busy, setBusy] = useState(false);
  // 응답을 못 받아 다시 누르면 같은 키로 보내 서버가 두 번 주지 않는다(서버는 성공 · 409만 기억한다). 받은 뒤 다음
  // 선물(T-11-386)은 새 키로 받는다.
  const key = useRef(crypto.randomUUID());
  const reload = useCallback(async () => setGift(await fetchHomeGift()), []);
  // 알림으로 홈을 열면(home이 늘면) 이미 홈에 있어도 다시 묻는다(T-11-388).
  const { home } = useSnapshot(notificationDestination);
  useEffect(() => {
    void reload();
  }, [reload, home]);
  useOnPull(reload);
  if (!gift) return null;
  const copy = giftCopy(gift);

  const claim = async () => {
    if (busy) return;
    setBusy(true);
    const r = await claimHomeGift(gift.id, key.current);
    setBusy(false);
    if (r.ok) {
      toast(copy.done);
      key.current = crypto.randomUUID();
      setGift(null);
    } else if (r.error.reason === 'GIFT_CLAIMED' || r.error.reason === 'GOOGLE_LOGIN_REQUIRED') {
      setGift(null);
    } else {
      toast(L.fail);
    }
  };

  return (
    <Card
      testID="home-gift"
      gap={12}
      style={{ borderWidth: 1, borderColor: alpha(c.accent, 0.45), flexDirection: 'row' }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Txt v="eyebrow">Gift</Txt>
        <Txt bold accessibilityRole="header">
          {copy.title}
        </Txt>
        <Txt v="sm" tone="muted">
          {copy.sub}
        </Txt>
      </View>
      <View style={{ justifyContent: 'center' }}>
        <Btn kind="accent" disabled={busy} testID="home-gift-claim" onPress={() => void claim()}>
          {busy ? L.busy : L.btn}
        </Btn>
      </View>
    </Card>
  );
}
