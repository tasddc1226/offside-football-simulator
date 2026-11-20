// T-11-770c 은퇴 뒤 시즌 패스 안내(웹 PassNudgeCard.svelte, 기획 T-11-747 R1). 패스가 없는 구단주가 이번 시즌 은퇴 5 · 9 · 15 · 25명을
// 넘긴 것이 확인되면 내 은퇴 선수 카드들 아래에 한 번 보인다. 서버를 부르지 않고(app-core passNudge가 기기에 적어 둔 어림),
// 보상 수량은 적지 않는다. '시즌 패스 보기'가 여는 패스 화면이 실제 진행도 · 보상을 서버에서 받는다.
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { onPassNudge, takePassNudge } from '@offside/app-core/passNudge';
import { hofOwnText as L } from '@offside/app-core/i18n/ko/hofOwn';
import { passEntryOpen, SEASON_PASS_IOS_LIVE } from '@offside/contracts/season-pass';
import { goSeasonPass } from '../../game/nav';
import { Btn } from '../../ui';
import { Card } from '../../ui/Card';
import { Txt } from '../../ui/Txt';

const live = () =>
  passEntryOpen(new Date().toISOString()) && (Platform.OS !== 'ios' || SEASON_PASS_IOS_LIVE);

export function PassNudgeCard() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!live()) return;
    const check = () => {
      if (takePassNudge() !== null) setShown(true);
    };
    check();
    // 이 은퇴가 서버에 올라간 뒤에 기준을 넘길 수 있어, 올라갈 때 한 번 더 본다.
    return onPassNudge(check);
  }, []);
  if (!shown) return null;
  return (
    <Card testID="pass-nudge">
      <View>
        <Txt v="eyebrow">Season pass</Txt>
        <Txt v="h2" accessibilityRole="header">
          {L.passNudgeTitle}
        </Txt>
      </View>
      <Txt v="sm" tone="muted">
        {L.passNudgeBody}
      </Txt>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Btn kind="accent" testID="pass-nudge-go" onPress={goSeasonPass}>
          {L.passNudgeGo}
        </Btn>
        <Btn kind="ghost" testID="pass-nudge-close" onPress={() => setShown(false)}>
          {L.passNudgeClose}
        </Btn>
      </View>
    </Card>
  );
}
