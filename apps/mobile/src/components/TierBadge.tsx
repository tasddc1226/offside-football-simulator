// T-11-128 구단주 티어(시즌 휘장) 작은 표시(웹 TierBadge.svelte) — 날개 문장 + 티어 이름 알약. 댓글 · 채팅 닉네임 옆에 붙는다.
import { View } from 'react-native';
import { TIER_PALETTE } from '@offside/app-core/tierCrest';
import { tierName, tierTitle, type OwnerTierTag } from '@offside/app-core/ownerTier';
import { alpha, mix } from '../theme/colors';
import { rem } from '../theme/type';
import { useIsDark } from '../theme/useColors';
import { Txt } from '../ui/Txt';
import { TierCrest } from './TierCrest';

export function TierBadge({ tag }: { tag: OwnerTierTag }) {
  const dark = useIsDark();
  const c = TIER_PALETTE[tag.tier];
  return (
    <View
      testID={`tier-badge-${tag.tier}`}
      accessible
      accessibilityLabel={tierTitle(tag)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 1,
        height: 20,
        paddingRight: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: alpha(c.base, 0.5),
        backgroundColor: alpha(c.base, 0.14),
      }}
    >
      <View style={{ marginLeft: -4, marginRight: -2 }}>
        <TierCrest tier={tag.tier} size={30} />
      </View>
      <Txt
        accessibilityElementsHidden
        style={{
          fontSize: rem(0.75),
          lineHeight: rem(0.75) * 1.2,
          fontWeight: '700',
          // 라이트 테마는 흰 바탕에서 읽히게 어둡게 섞는다(웹 :root[data-theme='light'] .tier-badge).
          color: dark ? c.hi : mix(c.base, '#000000', 0.75),
        }}
      >
        {tierName(tag.tier)}
      </Txt>
    </View>
  );
}
