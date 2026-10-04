import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { useSnapshot } from 'valtio';
import { pushState, pushRegistration, testOwnPush } from '../../platform/push';
import { Btn, Txt } from '../../ui';
import { SettingsCard, SettingsLabel } from './parts';
import { cachedGet } from '@offside/app-core/api/client';
import { WEB_ORIGIN } from '../../platform/config';
import { dismissPushOffer } from '../../platform/pushOffer';

export function PushSettings() {
  const state = useSnapshot(pushState);
  const [testMessage, setTestMessage] = useState('');
  const [testing, setTesting] = useState(false);
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    let alive = true;
    void cachedGet<{ admin: boolean }>('/v1/boards/viewer', 300_000).then((r) => {
      if (alive && r.ok) setAdmin(r.data.admin);
    });
    return () => {
      alive = false;
    };
  }, []);
  return (
    <SettingsCard gap={12}>
      <SettingsLabel
        eyebrow="Notifications"
        title="새 소식 알림"
        muted="공지·릴리즈 노트 알림을 준비하고 있어요. 이 기기의 수신 권한을 연결할 수 있어요. 정식 발송은 아직 시작하지 않았어요."
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
        {admin && state.enabled ? (
          <Btn
            block
            disabled={testing || state.busy}
            testID="push-test"
            onPress={() => {
              setTesting(true);
              void testOwnPush()
                .then(
                  () =>
                    setTestMessage(
                      '테스트 요청을 보냈어요. 앱을 닫아 둔 상태에서도 수신을 확인해 주세요.',
                    ),
                  (e) =>
                    setTestMessage(
                      e instanceof Error ? e.message : '테스트 요청을 보내지 못했어요.',
                    ),
                )
                .finally(() => setTesting(false));
            }}
          >
            {testing ? '요청 중…' : '내 기기로 테스트 알림 보내기'}
          </Btn>
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
