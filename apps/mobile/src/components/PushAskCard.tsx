// T-11-509 은퇴 리포트 아래 알림 권유 카드. 은퇴 때는 전면 광고가 뜰 수 있어 확인 창 대신 리포트 끝에 둔다.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSnapshot } from 'valtio';
import { pushText as L } from '@offside/app-core/i18n/ko/push';
import { acceptPushAsk, laterPushAsk, pushAskOpen, trackPushAskView } from '../platform/pushAsk';
import { pushState } from '../platform/push';
import { Btn, Card, Txt } from '../ui';

export function PushAskCard() {
  const push = useSnapshot(pushState);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let alive = true;
    void pushAskOpen('retire').then((ok) => {
      if (!alive || !ok) return;
      setOpen(true);
      trackPushAskView('retire');
    });
    return () => {
      alive = false;
    };
  }, []);
  if (!open || push.enabled) return null;
  return (
    <Card testID="retire-push-ask" gap={8}>
      <Txt bold>{L.askRetireTitle}</Txt>
      <Txt tone="muted" v="sm">
        {L.askRetireBody}
      </Txt>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Btn
          sm
          kind="primary"
          testID="retire-push-ask-on"
          disabled={push.busy}
          onPress={() =>
            void acceptPushAsk('retire').then(() => {
              if (!pushState.failed) setOpen(false);
            })
          }
        >
          {push.busy ? L.busy : L.askOn}
        </Btn>
        <Btn
          sm
          kind="ghost"
          testID="retire-push-ask-later"
          disabled={push.busy}
          onPress={() => {
            laterPushAsk('retire');
            setOpen(false);
          }}
        >
          {L.askLater}
        </Btn>
      </View>
      {push.failed && push.message ? (
        <Txt tone="muted" v="sm" accessibilityLiveRegion="polite">
          {push.message}
        </Txt>
      ) : null}
    </Card>
  );
}
