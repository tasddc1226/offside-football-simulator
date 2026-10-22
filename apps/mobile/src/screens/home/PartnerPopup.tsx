// T-11-423 아마축구 상호 홈 팝업(웹 PartnerPopup.svelte) — 앱을 켜 홈에 왔을 때 한 번 아래에서 올라오는 시트로 소재 한 장을
// 띄운다(규칙은 app-core partnerPopup.ts). 컵 우승 팝업이 먼저 자리를 잡을 수 있게 잠시 기다리고, 이용 분석 동의 창이 떠
// 있으면 띄우지 않는다(iOS는 창 두 개를 함께 띄우지 못한다). 그림을 다 받은 뒤에만 띄워 빈 시트가 보이지 않게 한다.
// 그림을 누르면 기기에 맞는 아마축구 스토어를 연다.
import { useEffect, useState } from 'react';
import { Image, Linking, Modal, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSnapshot } from 'valtio';
import {
  PARTNER_POPUP,
  hidePartnerPopupToday,
  markPartnerPopupShown,
  partnerPopupToShow,
  type PartnerVariant,
} from '@offside/app-core/partnerPopup';
import { claimHomePopup } from '@offside/app-core/homePopup';
import { partnerText as L } from '@offside/app-core/i18n/ko/partner';
import { nativeAnalytics } from '../../analytics';
import { analyticsAskPending } from '../../components/AnalyticsAsk';
import { prefs } from '../../store';
import { useColors } from '../../theme/useColors';
import { Press, Txt } from '../../ui';

const WAIT_MS = 1200;

export function PartnerPopup() {
  const [variant, setVariant] = useState<PartnerVariant | null>(null);
  useEffect(() => {
    const first = partnerPopupToShow();
    if (!first) return;
    let alive = true;
    const t = setTimeout(() => {
      void Image.prefetch(PARTNER_POPUP.imageUrl(first))
        .catch(() => false)
        .then((ok) => {
          const v = partnerPopupToShow();
          if (!alive || !ok || !v || analyticsAskPending() || !claimHomePopup()) return;
          markPartnerPopupShown();
          setVariant(v);
          nativeAnalytics.partnerPopup('view', v);
        });
    }, WAIT_MS);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, []);
  if (!variant) return null;

  const close = (action: 'close' | 'hide_today') => {
    if (action === 'hide_today') hidePartnerPopupToday();
    nativeAnalytics.partnerPopup(action, variant);
    setVariant(null);
  };
  const open = () => {
    nativeAnalytics.partnerPopup('click', variant);
    setVariant(null);
    void Linking.openURL(
      PARTNER_POPUP.link(variant, Platform.OS === 'ios' ? 'ios' : 'android'),
    ).catch(() => {});
  };
  return <Body variant={variant} open={open} close={close} />;
}

function Body({
  variant,
  open,
  close,
}: {
  variant: PartnerVariant;
  open: () => void;
  close: (action: 'close' | 'hide_today') => void;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { motionOK } = useSnapshot(prefs);
  return (
    <Modal
      visible
      transparent
      animationType={motionOK ? 'slide' : 'none'}
      statusBarTranslucent
      onRequestClose={() => close('close')}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
        <Pressable
          accessibilityLabel={L.close}
          onPress={() => close('close')}
          style={{ position: 'absolute', inset: 0, backgroundColor: c.scrim }}
        />
        <View
          accessibilityViewIsModal
          accessibilityLabel={L.aria}
          testID={`partner-popup-${variant}`}
          style={{
            width: '100%',
            maxWidth: 440,
            overflow: 'hidden',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            backgroundColor: c.surface,
          }}
        >
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={L.open}
            onPress={open}
            testID="partner-open"
          >
            <Image
              source={{ uri: PARTNER_POPUP.imageUrl(variant) }}
              accessibilityLabel={variant === 'a' ? L.altA : L.altB}
              style={{ width: '100%', aspectRatio: 4 / 5, backgroundColor: '#f3f4f8' }}
              resizeMode="contain"
            />
            <View
              style={{
                position: 'absolute',
                bottom: 10,
                left: 10,
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 999,
                backgroundColor: 'rgba(8,14,11,0.55)',
              }}
            >
              <Txt v="xs" style={{ color: '#fff' }}>
                {L.badge}
              </Txt>
            </View>
          </Pressable>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingHorizontal: 8,
              paddingBottom: insets.bottom,
            }}
          >
            <Press
              onPress={() => close('hide_today')}
              testID="partner-hide-today"
              style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 12 }}
            >
              <Txt v="sm" tone="muted">
                {L.hideToday}
              </Txt>
            </Press>
            <Press
              onPress={() => close('close')}
              testID="partner-close"
              style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 12 }}
            >
              <Txt v="sm" bold>
                {L.close}
              </Txt>
            </Press>
          </View>
        </View>
      </View>
    </Modal>
  );
}
