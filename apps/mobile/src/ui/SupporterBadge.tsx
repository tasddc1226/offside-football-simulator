// T-11-818 서포터 뱃지(웹 SupporterBadge.svelte). 클럽 멤버십 연속 구독 단계 1 · 3 · 6 · 9개월을 색으로 가른다.
// 구독 중이 아니면 아무것도 그리지 않는다.
import { FONT, RADIUS } from '@offside/app-core/design-tokens';
import { supporterPill } from '@offside/app-core/supporter';
import type { SupporterTier } from '@offside/contracts/membership';
import { View } from 'react-native';
import { mix } from '../theme/colors';
import { rem } from '../theme/type';
import { useColors } from '../theme/useColors';
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
  const top = pill.tier === 9;
  const fg = top ? c.accentInk : pill.tier === 6 ? c.r3 : pill.tier === 3 ? c.r2 : c.good;
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={pill.label}
      style={{
        flexShrink: 0,
        borderRadius: RADIUS.xs,
        paddingVertical: small ? 1 : 2,
        paddingHorizontal: small ? 6 : 8,
        backgroundColor: top ? c.accent : mix(fg, c.surface, 0.12),
      }}
    >
      <Txt
        style={{
          fontSize: rem(small ? FONT.caption2 : FONT.caption),
          fontWeight: '600',
          color: fg,
        }}
      >
        {pill.text}
      </Txt>
    </View>
  );
}
