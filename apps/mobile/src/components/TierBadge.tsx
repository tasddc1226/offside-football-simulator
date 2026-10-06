// T-11-128 구단주 티어 작은 표시(웹 TierBadge.svelte) — 구단주 랭킹과 같은 업적 등급 엠블럼만(글자 없음).
// 댓글 · 채팅 닉네임 옆에 붙는다. 등급 이름은 접근성 글자로만 남긴다.
import { View } from 'react-native';
import { tierTitle, type OwnerTierTag } from '@offside/app-core/ownerTier';
import { GradeEmblem } from '../ui/GradeEmblem';

export function TierBadge({ tag }: { tag: OwnerTierTag }) {
  return (
    <View
      testID={`tier-badge-${tag.tier}`}
      accessible
      accessibilityRole="image"
      accessibilityLabel={tierTitle(tag)}
      style={{ justifyContent: 'center' }}
    >
      <GradeEmblem id={tag.tier} size={18} />
    </View>
  );
}
