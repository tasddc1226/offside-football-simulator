// T-11-130 홈 섹션 머리의 '더보기 ›'(웹 MoreLink.svelte). 상자 버튼 대신 글자와 오른쪽 꺾쇠로 다른 화면으로 넘어간다는 것을 보인다.
import Svg, { Path } from 'react-native-svg';
import { homeText as L } from '@offside/app-core/i18n/ko/home';
import { rem } from '../theme/type';
import { useColors } from '../theme/useColors';
import { Press } from './Press';
import { Txt } from './Txt';

export function MoreLink({
  testID,
  what,
  onPress,
}: {
  testID: string;
  what: string;
  onPress: () => void;
}) {
  const c = useColors();
  return (
    <Press
      testID={testID}
      accessibilityLabel={L.moreAria({ what })}
      hitSlop={8}
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingLeft: 10 }}
    >
      <Txt bold style={{ color: c.accentText, fontSize: rem(0.875) }}>
        {L.more}
      </Txt>
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
        <Path
          d="m9 6 6 6-6 6"
          stroke={c.accentText}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Press>
  );
}
