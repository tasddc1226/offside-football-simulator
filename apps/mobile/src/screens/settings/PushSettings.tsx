import { useEffect, useState } from 'react';
import { AppState, Linking, View } from 'react-native';
import { useSnapshot } from 'valtio';
import { pushState, pushTestState, pushRegistration, testOwnPush } from '../../platform/push';
import { openInbox } from '../../platform/inbox';
import { Btn, Txt } from '../../ui';
import { SettingsCard, SettingsLabel, SettingsRow, Switch } from './parts';
import { WEB_ORIGIN } from '../../platform/config';
import { dismissPushOffer } from '../../platform/pushOffer';
import {
  loadPushPreferences,
  pushPreferencesState,
  setPushPreference,
} from '../../platform/pushPreferences';
import type { PushPreferences } from '@offside/contracts';
import { pushText as L } from '@offside/app-core/i18n/ko/push';
import { intlLocale } from '@offside/app-core/i18n/core';

const categories = (): { key: keyof PushPreferences; title: string; description: string }[] => [
  { key: 'notice', title: L.catNotice, description: L.catNoticeBody },
  { key: 'release', title: L.catRelease, description: L.catReleaseBody },
  { key: 'team', title: L.catTeam, description: L.catTeamBody },
  { key: 'market', title: L.catMarket, description: L.catMarketBody },
  { key: 'social', title: L.catSocial, description: L.catSocialBody },
];

export function PushSettings() {
  const state = useSnapshot(pushState);
  const preferences = useSnapshot(pushPreferencesState);
  useEffect(() => {
    void loadPushPreferences();
  }, [preferences.sessionRevision]);
  const [testMessage, setTestMessage] = useState('');
  const test = useSnapshot(pushTestState);
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
      <SettingsRow>
        <SettingsLabel eyebrow="Notifications" title={L.title} muted={L.body} />
        <Switch
          value={state.enabled}
          busy={state.busy}
          testID="push-toggle"
          label={L.title}
          onChange={(on) => {
            setTestMessage('');
            dismissPushOffer();
            void pushRegistration.setEnabled(on);
          }}
        />
      </SettingsRow>
      <View style={{ gap: 12 }}>
        <Txt tone="muted">{L.prefsNote}</Txt>
        {categories().map(({ key, title, description }) => (
          <SettingsRow key={key}>
            <SettingsLabel title={title} muted={description} />
            <Switch
              value={preferences.values[key]}
              label={L.catAria({ title })}
              testID={`push-${key}-toggle`}
              busy={preferences.saving === key}
              disabled={!preferences.loaded || preferences.loading || preferences.saving !== null}
              onChange={(on) => {
                void setPushPreference(key, on);
              }}
            />
          </SettingsRow>
        ))}
        {preferences.loading ? (
          <Txt tone="muted" accessibilityLiveRegion="polite">
            {L.prefsLoading}
          </Txt>
        ) : null}
        {preferences.error ? (
          <Txt tone="muted" accessibilityLiveRegion="polite">
            {preferences.error}
          </Txt>
        ) : null}
        {!preferences.loaded && !preferences.loading ? (
          <Btn block onPress={() => void loadPushPreferences()}>
            {L.prefsReload}
          </Btn>
        ) : null}
      </View>
      <Txt tone="muted">{L.tokenNote}</Txt>
      <View style={{ gap: 8 }}>
        {state.busy ? (
          <Txt tone="muted" accessibilityLiveRegion="polite">
            {L.busy}
          </Txt>
        ) : null}
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
