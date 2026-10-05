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

const categories: { key: keyof PushPreferences; title: string; description: string }[] = [
  { key: 'notice', title: '공지', description: '운영 공지와 이벤트 안내' },
  { key: 'release', title: '업데이트', description: '새 버전과 기능 업데이트' },
  { key: 'team', title: '내 팀', description: '상대가 건 경기 결과' },
  { key: 'market', title: '이적시장', description: '등록한 선수의 판매 완료' },
  { key: 'social', title: '친구', description: '친구 신청·수락과 친선전 결과' },
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
        <SettingsLabel
          eyebrow="Notifications"
          title="앱 알림 받기"
          muted="이 기기의 전체 알림을 켜고 꺼요."
        />
        <Switch
          value={state.enabled}
          busy={state.busy}
          testID="push-toggle"
          label="앱 알림 받기"
          onChange={(on) => {
            setTestMessage('');
            dismissPushOffer();
            void pushRegistration.setEnabled(on);
          }}
        />
      </SettingsRow>
      <View style={{ gap: 12 }}>
        <Txt tone="muted">
          종류별 선택은 계정에 저장돼요. 전체 알림을 꺼도 아래 선택은 유지돼요.
        </Txt>
        {categories.map(({ key, title, description }) => (
          <SettingsRow key={key}>
            <SettingsLabel title={title} muted={description} />
            <Switch
              value={preferences.values[key]}
              label={`${title} 알림`}
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
            알림 종류를 불러오는 중…
          </Txt>
        ) : null}
        {preferences.error ? (
          <Txt tone="muted" accessibilityLiveRegion="polite">
            {preferences.error}
          </Txt>
        ) : null}
        {!preferences.loaded && !preferences.loading ? (
          <Btn block onPress={() => void loadPushPreferences()}>
            알림 종류 다시 불러오기
          </Btn>
        ) : null}
      </View>
      <Txt tone="muted">
        알림 연결을 위해 푸시 토큰과 기기 종류·앱 버전을 저장해요. 발송 결과·알림 클릭·연결 화면
        이동은 서비스 운영을 위해 서버에 90일간 보관해요.
      </Txt>
      <View style={{ gap: 8 }}>
        {state.busy ? (
          <Txt tone="muted" accessibilityLiveRegion="polite">
            알림 설정 중…
          </Txt>
        ) : null}
        {state.blocked ? (
          <Btn block onPress={() => void Linking.openSettings()}>
            기기 알림 설정 열기
          </Btn>
        ) : null}
        {state.message ? (
          <Txt tone="muted" accessibilityLiveRegion="polite">
            {state.message}
          </Txt>
        ) : null}
        {state.failed && state.enabled ? (
          <Btn block disabled={state.busy} onPress={() => void pushRegistration.restore()}>
            다시 연결
          </Btn>
        ) : null}
        {state.enabled ? (
          <>
            <Txt tone="muted">
              테스트 알림은 이 기기에만 보내요. 기기·계정마다 10분에 한 번, 하루 3회까지 요청할 수
              있어요.
            </Txt>
            <Btn
              block
              disabled={test.busy || state.busy || state.failed || waiting}
              testID="push-test"
              onPress={() => {
                setTestMessage('');
                void testOwnPush().then(
                  () =>
                    setTestMessage(
                      '테스트 알림을 요청했어요. 기기 알림센터에서 수신을 확인해 주세요.',
                    ),
                  (e) =>
                    setTestMessage(
                      e instanceof Error ? e.message : '테스트 요청을 보내지 못했어요.',
                    ),
                );
              }}
            >
              {test.busy ? '요청 중…' : '내 기기로 테스트 알림 보내기'}
            </Btn>
            {waiting ? (
              <Txt tone="muted" accessibilityLiveRegion="polite">
                다음 테스트:{' '}
                {new Date(test.nextTestAt).toLocaleString('ko-KR', {
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
          알림함 열기
        </Btn>
        <Btn block onPress={() => void Linking.openURL(`${WEB_ORIGIN}/legal/privacy/#push`)}>
          알림 정보 처리 안내
        </Btn>
      </View>
    </SettingsCard>
  );
}
