import { useEffect, useState } from 'react';
import { AppState, Linking, View } from 'react-native';
import { useSnapshot } from 'valtio';
import {
  pushState,
  pushTestState,
  pushRegistration,
  quietPushOn,
  testOwnPush,
} from '../../platform/push';
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
import type { PushTopic } from '@offside/contracts';
import { GROUP_TOPICS, PUSH_GROUPS, type PushGroup } from '@offside/app-core/pushTopics';
import { applyPushPicks } from '../../platform/pushAsk';
import { pushText as L } from '@offside/app-core/i18n/ko/push';
import { intlLocale } from '@offside/app-core/i18n/core';

// 묶음 제목 아래에 주제를 놓는다(선택 창 · 알림함 묶음 보기와 같은 구분).
const topicText = (): Record<PushTopic, [string, string]> => ({
  match: [L.topMatch, L.topMatchBody],
  cup: [L.topCup, L.topCupBody],
  league: [L.topLeague, L.topLeagueBody],
  market: [L.catMarket, L.catMarketBody],
  friend: [L.catSocial, L.catSocialBody],
  reward: [L.topReward, L.topRewardBody],
  notice: [L.catNotice, L.catNoticeBody],
  release: [L.catRelease, L.catReleaseBody],
  attendance: [L.topAttendance, L.topAttendanceBody],
  comeback: [L.topComeback, L.topComebackBody],
});
const groupTitle = (): Record<PushGroup, string> => ({
  game: L.grpGame,
  market: L.catMarket,
  social: L.grpSocial,
  news: L.grpNews,
  nudge: L.grpNudge,
});

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
            // 권유에서 고른 알림이 기기에 남아 있으면(OS에서 거절했던 경우) 켜진 뒤 계정에 저장한다.
            void pushRegistration.setEnabled(on).then(() => (on ? applyPushPicks() : undefined));
          }}
        />
      </SettingsRow>
      {!state.enabled && quietPushOn() ? <Txt tone="muted">{L.quietNote}</Txt> : null}
      <View style={{ gap: 12 }}>
        <Txt tone="muted">{L.prefsNote}</Txt>
        {PUSH_GROUPS.map((group) => (
          <View key={group} style={{ gap: 4 }}>
            {/* 주제가 하나뿐인 묶음(이적시장)은 묶음 제목 없이 주제만 둔다. */}
            {GROUP_TOPICS[group].length > 1 ? (
              <Txt bold tone="muted" v="sm" accessibilityRole="header">
                {groupTitle()[group]}
              </Txt>
            ) : null}
            {GROUP_TOPICS[group].map((key) => {
              const [title, description] = topicText()[key];
              return (
                <SettingsRow key={key}>
                  <SettingsLabel title={title} muted={description} />
                  <Switch
                    value={preferences.values[key]}
                    label={L.catAria({ title })}
                    testID={`push-${key}-toggle`}
                    busy={preferences.saving === key}
                    disabled={
                      !preferences.loaded || preferences.loading || preferences.saving !== null
                    }
                    onChange={(on) => {
                      void setPushPreference(key, on);
                    }}
                  />
                </SettingsRow>
              );
            })}
          </View>
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
