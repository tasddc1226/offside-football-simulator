import { useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { toast } from '../../game/host';
import { Btn, Card, Txt } from '../../ui';

// 웹과 같은 기존 공개 후원 정보. 게임 혜택·광고 제거 구매와 연결하지 않는다.
const ACCOUNT = '토스뱅크 1000-1599-4723 양*영';

export function VoluntarySupport() {
  const [busy, setBusy] = useState(false);

  async function copyAccount() {
    if (busy) return;
    setBusy(true);
    try {
      const copied = await Clipboard.setStringAsync(ACCOUNT);
      toast(
        copied
          ? '계좌번호를 복사했어요. 고마워요'
          : '복사하지 못했어요. 아래 계좌번호를 직접 적어 주세요',
      );
    } catch {
      toast('복사하지 못했어요. 아래 계좌번호를 직접 적어 주세요');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card testID="home-support" gap={10}>
      <Txt v="h2" accessibilityRole="header">
        개발자 응원하기
      </Txt>
      <Txt v="sm" tone="muted">
        재밌게 즐기셨다면 개발을 응원해 주세요. 후원은 선택이며, 게임 혜택이나 광고 제거는 제공하지
        않아요.
      </Txt>
      <Btn
        testID="coffee"
        disabled={busy}
        onPress={() => void copyAccount()}
        style={{ alignSelf: 'flex-start' }}
      >
        후원 계좌 복사
      </Btn>
      <Txt v="sm" tone="muted" selectable>
        {ACCOUNT}
      </Txt>
    </Card>
  );
}
