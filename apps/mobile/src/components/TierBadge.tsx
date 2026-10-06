// T-11-128 구단주 티어(시즌 휘장) 작은 표시(웹 TierBadge.svelte) — 글자 없이 휘장만. 댓글 · 채팅 닉네임 옆에 붙는다.
// 티어 이름은 접근성 글자로만 남긴다.
import { View } from 'react-native';
import { tierTitle, type OwnerTierTag } from '@offside/app-core/ownerTier';
import { TierCrest } from './TierCrest';

export function TierBadge({ tag }: { tag: OwnerTierTag }) {
  return (
    <View
      testID={`tier-badge-${tag.tier}`}
      accessible
      accessibilityRole="image"
      accessibilityLabel={tierTitle(tag)}
      // 휘장이 줄 높이를 밀지 않게 위아래를 겹친다(웹 .tier-badge).
      style={{ marginVertical: -9, marginHorizontal: -3 }}
    >
      <TierCrest tier={tag.tier} size={44} />
    </View>
  );
}
