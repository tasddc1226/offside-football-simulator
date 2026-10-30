// 홈 선물 칸(T-11-386 시즌 업적 보상 → T-11-487 시즌 기록 보상, T-11-472 구단주 선물은 없앴다)(웹 HomeGift.svelte) — 오프사이드 컵 배너 바로 아래. 로그인한 구단주가 한 번 받으면 사라진다.
// 묻는 조건 · 메모는 app-core api/gift.ts.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { useSnapshot } from 'valtio';
import {
  claimHomeGift,
  fetchHomeGift,
  giftCopy,
  type HomeGift as Gift,
} from '@offside/app-core/api/gift';
import { giftText as L } from '@offside/app-core/i18n/ko/gift';
import { toast } from '../../game/host';
import { goRerollShop } from '../../game/nav';
import { notificationDestination } from '../../platform/notificationDestination';
import { reviewPrompt } from '../../platform/review';
import { interstitial } from '../../platform/interstitial';
import { rnAlert, sheetState } from '../../store';
import { alpha } from '../../theme/colors';
import { useColors } from '../../theme/useColors';
import { Btn, Card, Txt } from '../../ui';
import { useOnPull } from '../../ui/refresh';

export function HomeGift() {
  const c = useColors();
  const [gift, setGift] = useState<Gift | null>(null);
  const [busy, setBusy] = useState(false);
  // T-11-440 받은 뒤 결과 줄 · 쓰는 곳 안내 · 내 구단 버튼(토스트 한 번으로 끝내지 않는다). 홈을 떠나면 사라진다.
  const [done, setDone] = useState<string | null>(null);
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
  const doneCard = done ? (
    <Card
      testID="home-gift-done"
      gap={10}
      style={{ borderWidth: 1, borderColor: alpha(c.accent, 0.45) }}
    >
      <View style={{ gap: 2 }} accessibilityLiveRegion="polite">
        <Txt v="eyebrow">Gift</Txt>
        <Txt bold accessibilityRole="header">
          {L.doneTitle}
        </Txt>
        <Txt v="sm">{done}</Txt>
        <Txt v="xs" tone="muted">
          {L.useHint}
        </Txt>
      </View>
      <Btn sm testID="home-gift-owner" onPress={goRerollShop} style={{ alignSelf: 'flex-start' }}>
        {L.toOwner}
      </Btn>
    </Card>
  ) : null;
  if (!gift) return doneCard;
  const copy = giftCopy(gift);

  const claim = async () => {
    if (busy) return;
    setBusy(true);
    const r = await claimHomeGift(gift.id, key.current);
    setBusy(false);
    if (r.ok) {
      setDone(copy.done);
      // T-11-586 시즌 보상을 받은 직후는 리뷰를 묻기 좋은 순간이다. 결과 카드가 자리 잡은 뒤 OS 리뷰 창을 요청한다.
      const giftId = gift.id;
      setTimeout(() => {
        void reviewPrompt.afterHighlight(
          `gift:${giftId}`,
          () =>
            AppState.currentState === 'active' &&
            !sheetState.open &&
            !rnAlert.item &&
            !interstitial.showing,
        );
      }, 1500);
      key.current = crypto.randomUUID();
      setGift(null);
      // T-11-487 업적 보상 다음에 기록 보상이 있으면 바로 이어 보인다.
      void reload();
    } else if (r.error.reason === 'GIFT_CLAIMED' || r.error.reason === 'GOOGLE_LOGIN_REQUIRED') {
      setGift(null);
    } else {
      toast(L.fail);
    }
  };

  return (
    <>
      {doneCard}
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
          {copy.detail ? (
            <Txt v="xs" testID="home-gift-detail">
              {copy.detail}
            </Txt>
          ) : null}
        </View>
        <View style={{ justifyContent: 'center' }}>
          <Btn kind="accent" disabled={busy} testID="home-gift-claim" onPress={() => void claim()}>
            {busy ? L.busy : L.btn}
          </Btn>
        </View>
      </Card>
    </>
  );
}
