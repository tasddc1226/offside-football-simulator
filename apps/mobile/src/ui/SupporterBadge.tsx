// T-11-818 서포터 뱃지(웹 SupporterBadge.svelte). 클럽 멤버십 연속 구독 단계 1 · 3 · 6 · 9개월. T-11-819부터 별 방패 휘장을
// 붙인다. 좁은 줄(small)은 휘장만, 넓은 곳은 휘장 + "서포터 N개월" 글자. 구독 중이 아니면 아무것도 그리지 않는다.
import { FONT, RADIUS } from '@offside/app-core/design-tokens';
import { supporterPill } from '@offside/app-core/supporter';
import type { SupporterTier } from '@offside/contracts/membership';
import { View } from 'react-native';
import { mix } from '../theme/colors';
import { rem } from '../theme/type';
import { useColors } from '../theme/useColors';
import { SupporterCrest } from './SupporterCrest';
import { Txt } from './Txt';

export function SupporterBadge({
  tier,
  member = false,
  small = false,
  testID,
}: {
  tier?: SupporterTier | null | undefined;
  member?: boolean;
  small?: boolean;
  testID?: string;
}) {
  const c = useColors();
  const pill = supporterPill(tier, member);
  if (!pill) return null;
  if (small)
    return (
      <View
        testID={testID}
        accessible
        accessibilityRole="image"
        accessibilityLabel={pill.label}
        style={{ flexShrink: 0, marginLeft: 2 }}
      >
        <SupporterCrest tier={pill.tier} size={16} />
      </View>
    );
  const fg =
    pill.tier === 9 ? c.accentText : pill.tier === 6 ? c.r3 : pill.tier === 3 ? c.r2 : c.good;
  const bgBase = pill.tier === 9 ? c.accent : fg;
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={pill.label}
      style={{
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderRadius: RADIUS.pill,
        paddingVertical: 2,
        paddingLeft: 4,
        paddingRight: 9,
        backgroundColor: mix(bgBase, c.surface, pill.tier === 9 ? 0.2 : 0.12),
      }}
    >
      <SupporterCrest tier={pill.tier} size={18} />
      <Txt style={{ fontSize: rem(FONT.caption), fontWeight: '700', color: fg }}>{pill.text}</Txt>
    </View>
  );
}
