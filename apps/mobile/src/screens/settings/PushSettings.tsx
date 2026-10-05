import { useEffect, useState } from 'react';
import { AppState, Linking, View } from 'react-native';
import { useSnapshot } from 'valtio';
import { pushState, pushTestState, pushRegistration, testOwnPush } from '../../platform/push';
import { Btn, Txt } from '../../ui';
import { SettingsCard, SettingsLabel } from './parts';
import { WEB_ORIGIN } from '../../platform/config';
import { dismissPushOffer } from '../../platform/pushOffer';

export function PushSettings() {
  const state = useSnapshot(pushState);
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
      <SettingsLabel
        eyebrow="Notifications"
        title="새 소식 알림"
        muted="공지·릴리즈 노트의 새 글을 알려 드려요. 게시판마다 하루 한 번 보내요."
      />
      <Txt tone="muted">알림 연결을 위해 푸시 토큰과 기기 종류·앱 버전을 저장해요.</Txt>
      <View style={{ gap: 8 }}>
        <Btn
          block
          disabled={state.busy}
          testID="push-toggle"
          accessibilityLabel={
            state.enabled ? '이 기기의 새 소식 알림 끄기' : '이 기기의 새 소식 알림 받기'
          }
          onPress={() => {
            setTestMessage('');
            dismissPushOffer();
            void pushRegistration.setEnabled(!state.enabled);
          }}
        >
          {state.busy ? '알림 설정 중…' : state.enabled ? '알림 끄기' : '알림 받기'}
        </Btn>
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
        <Btn block onPress={() => void Linking.openURL(`${WEB_ORIGIN}/legal/privacy/#push`)}>
          알림 정보 처리 안내
        </Btn>
      </View>
    </SettingsCard>
  );
}
