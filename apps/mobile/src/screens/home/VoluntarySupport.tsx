import { useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { toast } from '../../game/host';
import { Btn, Card, Txt } from '../../ui';
import { homeText as L } from '@offside/app-core/i18n/ko/home';

// 웹과 같은 기존 공개 후원 정보. 게임 혜택·광고 제거 구매와 연결하지 않는다.
// 아직 홈에 붙이지 않는다(T-11-085): Apple 3.1.1은 개발자 팁을 인앱 결제로만 허용한다. 팁 IAP 상품을 만든 뒤 연다.
const ACCOUNT = '토스뱅크 1000-1599-4723 양*영';

export function VoluntarySupport() {
  const [busy, setBusy] = useState(false);

  async function copyAccount() {
    if (busy) return;
    setBusy(true);
    const copied = await Clipboard.setStringAsync(ACCOUNT).catch(() => false);
    toast(copied ? L.supportCopied : L.supportCopyFailed({ account: ACCOUNT }));
    setBusy(false);
  }

  return (
    <Card testID="home-support" gap={10}>
      <Txt v="h2" accessibilityRole="header">
        {L.supportTitle}
      </Txt>
      <Txt v="sm" tone="muted">
        {L.supportBody}
      </Txt>
      <Btn testID="coffee" block disabled={busy} onPress={() => void copyAccount()}>
        {L.supportCopy}
      </Btn>
    </Card>
  );
}
