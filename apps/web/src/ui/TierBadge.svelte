<script lang="ts">
  // T-11-128 구단주 티어 작은 표시 — 구단주 랭킹과 같은 업적 등급 엠블럼만(글자 없음). 댓글 · 채팅 닉네임 옆에 붙는다.
  // 등급 이름은 title · 스크린 리더로.
  import { tierTitle, type OwnerTierTag } from '@offside/app-core/ownerTier';
  import GradeEmblem from './team/GradeEmblem.svelte';

  let { tag }: { tag: OwnerTierTag } = $props();
</script>

<span class="tier-badge" role="img" title={tierTitle(tag)} aria-label={tierTitle(tag)} data-tier={tag.tier}>
  <GradeEmblem id={tag.tier} size={18} />
</span>
