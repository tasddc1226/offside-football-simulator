import { useEffect, useState } from 'react';
import { AppState, Linking, View } from 'react-native';
import { useSnapshot } from 'valtio';
import {
  pushState,
  pushTestState,
  pushRegistration,
  testOwnPush,
  engagementPushState,
  setEngagementPush,
} from '../../platform/push';
import { openInbox } from '../../platform/inbox';
import { Btn, Txt } from '../../ui';
import { SettingsCard, SettingsLabel } from './parts';
import { WEB_ORIGIN } from '../../platform/config';
import { dismissPushOffer } from '../../platform/pushOffer';
import { pushText as L } from '@offside/app-core/i18n/ko/push';
import { intlLocale } from '@offside/app-core/i18n/core';

export function PushSettings() {
  const state = useSnapshot(pushState);
  const [testMessage, setTestMessage] = useState('');
  const test = useSnapshot(pushTestState);
  const engagement = useSnapshot(engagementPushState);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    refresh();
    const timer = setTimeout(refresh, Math.max(0, test.nextTestAt - Date.now()));
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [test.nextTestAt]);
  const waiting = now < test.nextTestAt;
  return (
    <SettingsCard gap={12}>
      <SettingsLabel eyebrow="Notifications" title={L.title} muted={L.body} />
      <Txt tone="muted">{L.tokenNote}</Txt>
      <View style={{ gap: 8 }}>
        <Btn
          block
          disabled={state.busy}
          testID="push-toggle"
          accessibilityLabel={state.enabled ? L.offLabel : L.onLabel}
          onPress={() => {
            setTestMessage('');
            dismissPushOffer();
            void pushRegistration.setEnabled(!state.enabled);
          }}
        >
          {state.busy ? L.busy : state.enabled ? L.turnOff : L.turnOn}
        </Btn>
        {state.blocked ? (
          <Btn block onPress={() => void Linking.openSettings()}>
            {L.openSettings}
          </Btn>
        ) : null}
        {state.message ? (
          <Txt tone="muted" accessibilityLiveRegion="polite">
            {state.message}
          </Txt>
        ) : null}
        {state.failed && state.enabled ? (
          <Btn block disabled={state.busy} onPress={() => void pushRegistration.restore()}>
            {L.reconnect}
          </Btn>
        ) : null}
        {state.enabled ? (
          <>
            <Txt bold>{L.engagementTitle}</Txt>
            <Txt tone="muted">{L.engagementBody}</Txt>
            <Btn
              block
              disabled={state.busy}
              onPress={() => void setEngagementPush(!engagement.enabled)}
            >
              {engagement.enabled ? L.engagementOff : L.engagementOn}
            </Btn>
            <Txt tone="muted">{L.testNote}</Txt>
            <Btn
              block
              disabled={test.busy || state.busy || state.failed || waiting}
              testID="push-test"
              onPress={() => {
                setTestMessage('');
                void testOwnPush().then(
                  () => setTestMessage(L.testRequested),
                  (e) => setTestMessage(e instanceof Error ? e.message : L.testFailed),
                );
              }}
            >
              {test.busy ? L.testBusy : L.testBtn}
            </Btn>
            {waiting ? (
              <Txt tone="muted" accessibilityLiveRegion="polite">
                {L.nextTest}{' '}
                {new Date(test.nextTestAt).toLocaleString(intlLocale(), {
                  month: 'numeric',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Txt>
            ) : null}
          </>
        ) : null}
        {testMessage ? (
          <Txt tone="muted" accessibilityLiveRegion="polite">
            {testMessage}
          </Txt>
        ) : null}
        <Btn block onPress={() => openInbox()}>
          {L.openInbox}
        </Btn>
        <Btn block onPress={() => void Linking.openURL(`${WEB_ORIGIN}/legal/privacy/#push`)}>
          {L.privacy}
        </Btn>
      </View>
    </SettingsCard>
  );
}
