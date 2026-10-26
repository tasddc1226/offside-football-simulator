import { useEffect } from 'react';
import { AppState, Linking, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSnapshot } from 'valtio';
import { pushState } from '../../platform/push';
import { acceptPushAsk, laterPushAsk, trackPushAskView } from '../../platform/pushAsk';
import { checkPushOffer, pushOffer, pushOfferReady } from '../../platform/pushOffer';
import { appState } from '../../store';
import { useColors } from '../../theme/useColors';
import { Btn, Card, Txt } from '../../ui';
import { WEB_ORIGIN } from '../../platform/config';
import { homeMoreText } from '@offside/app-core/i18n/ko/homeMore';

export function PushOptInCard() {
  const state = useSnapshot(pushState);
  const offer = useSnapshot(pushOffer);
  const { G } = useSnapshot(appState);
  const c = useColors();
  useEffect(() => {
    void checkPushOffer();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void checkPushOffer();
    });
    return () => subscription.remove();
  }, []);
  const visible =
    !offer.handled &&
    Date.now() >= offer.snoozedUntil &&
    offer.eligible &&
    !state.enabled &&
    pushOfferReady(G);
  useEffect(() => {
    if (visible) trackPushAskView('home');
  }, [visible]);
  if (!visible) return null;
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
          {homeMoreText.pushTitle}
        </Txt>
      </View>
      <Txt tone="muted">{homeMoreText.pushBody}</Txt>
      <View style={{ gap: 8 }}>
        <Btn
          kind="primary"
          block
          disabled={state.busy}
          testID="push-opt-in-accept"
          onPress={() => {
            void acceptPushAsk('home');
          }}
        >
          {state.busy ? homeMoreText.pushBusy : homeMoreText.pushAccept}
        </Btn>
        <Btn
          kind="ghost"
          block
          disabled={state.busy}
          testID="push-opt-in-dismiss"
          onPress={() => laterPushAsk('home')}
        >
          {homeMoreText.pushLater}
        </Btn>
      </View>
      {state.message ? (
        <Txt tone="muted" accessibilityLiveRegion="polite">
          {state.message}
        </Txt>
      ) : null}
      <Btn
        kind="ghost"
        style={{ alignSelf: 'flex-start' }}
        testID="push-opt-in-privacy"
        onPress={() => void Linking.openURL(`${WEB_ORIGIN}/legal/privacy/#push`)}
      >
        {homeMoreText.pushPrivacy}
      </Btn>
    </Card>
  );
}
