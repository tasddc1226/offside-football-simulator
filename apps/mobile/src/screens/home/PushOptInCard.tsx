import { useEffect } from 'react';
import { Linking, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSnapshot } from 'valtio';
import { pushRegistration, pushState } from '../../platform/push';
import { checkPushOffer, dismissPushOffer, pushOffer } from '../../platform/pushOffer';
import { useColors } from '../../theme/useColors';
import { Btn, Card, Txt } from '../../ui';
import { WEB_ORIGIN } from '../../platform/config';

export function PushOptInCard() {
  const state = useSnapshot(pushState);
  const offer = useSnapshot(pushOffer);
  const c = useColors();
  useEffect(() => {
    void checkPushOffer();
  }, []);
  if (offer.handled || !offer.eligible || state.enabled) return null;
  return (
    <Card testID="push-opt-in" gap={12} style={{ borderWidth: 1, borderColor: c.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Svg width={22} height={22} viewBox="0 0 24 24" accessible={false}>
          <Path
            d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"
            fill="none"
            stroke={c.accentText}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
        <Txt bold accessibilityRole="header" style={{ flex: 1 }}>
          새 소식을 알림으로 받아볼까요?
        </Txt>
      </View>
      <Txt tone="muted">
        공지·릴리즈 노트 알림을 준비하고 있어요. 먼저 이 기기를 연결해 두세요. 설정에서 언제든 끌 수
        있어요.
      </Txt>
      <View style={{ gap: 8 }}>
        <Btn
          kind="primary"
          block
          disabled={state.busy}
          testID="push-opt-in-accept"
          onPress={() => {
            void pushRegistration.setEnabled(true).then(() => {
              if (!pushState.failed) dismissPushOffer();
            });
          }}
        >
          {state.busy ? '알림 연결 중…' : '알림 받기'}
        </Btn>
        <Btn
          kind="ghost"
          block
          disabled={state.busy}
          testID="push-opt-in-dismiss"
          onPress={dismissPushOffer}
        >
          나중에
        </Btn>
      </View>
      {state.message ? (
        <Txt tone="muted" accessibilityLiveRegion="polite">
          {state.message}
        </Txt>
      ) : null}
      <Btn
        kind="ghost"
        block
        testID="push-opt-in-privacy"
        onPress={() => void Linking.openURL(`${WEB_ORIGIN}/legal/privacy/#push`)}
      >
        알림 정보 처리 안내
      </Btn>
    </Card>
  );
}
