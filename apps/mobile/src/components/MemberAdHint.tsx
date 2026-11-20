// T-11-770b 광고를 고르는 자리의 멤버십 안내(기획 T-11-747 R3A). 광고 버튼 아래 작은 한 줄로 두고, 누르면 그 자리에서 혜택 세 줄을
// 펼친다. 광고 버튼 · 보상 흐름은 건드리지 않는다: 저절로 뜨지 않고, 광고를 누른 뒤에 끼어들지 않는다. '멤버십 보기'는 내 구단
// 화면의 멤버십 창으로 간다(가입 · 가격 · 자동 갱신 안내 · 복원은 그 창이 한다). 광고 없이 받는 사람(광고 제거 · 멤버십)에게는
// 부르는 쪽이 그리지 않는다(rewardOffer가 'ad'일 때만).
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { membershipText as L } from '@offside/app-core/i18n/ko/membership';
import { MEMBERSHIP_IOS_LIVE, MEMBERSHIP_LIVE } from '@offside/contracts/membership';
import { goMembership } from '../game/nav';
import { Btn, Txt } from '../ui';

const LIVE = MEMBERSHIP_LIVE && (Platform.OS !== 'ios' || MEMBERSHIP_IOS_LIVE);

export function MemberAdHint({ place, onGo }: { place: string; onGo?: () => void }) {
  const [open, setOpen] = useState(false);
  if (!LIVE) return null;
  return (
    <View style={{ gap: 6 }} testID={`member-hint-${place}`}>
      <Btn
        sm
        kind="ghost"
        testID={`member-hint-${place}-toggle`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={{ alignSelf: 'flex-start' }}
      >
        {L.adHint}
      </Btn>
      {open ? (
        <View style={{ gap: 4 }}>
          {[L.perkAdsSub, L.perkAttendSub, L.perkBoostSub].map((line) => (
            <Txt key={line} v="xs" tone="muted">
              {`· ${line}`}
            </Txt>
          ))}
          <Btn
            sm
            testID={`member-hint-${place}-go`}
            onPress={() => {
              onGo?.();
              goMembership();
            }}
            style={{ alignSelf: 'flex-start' }}
          >
            {L.adHintGo}
          </Btn>
        </View>
      ) : null}
    </View>
  );
}
