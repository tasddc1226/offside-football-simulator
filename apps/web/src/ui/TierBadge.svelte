<script lang="ts">
  // T-11-128 구단주 티어(시즌 휘장) 작은 표시 — 글자 없이 휘장만. 댓글 · 채팅 닉네임 옆에 붙는다(이름은 title · 스크린 리더로).
  import { tierTitle, type OwnerTierTag } from '@offside/app-core/ownerTier';
  import TierCrest from './TierCrest.svelte';

  let { tag }: { tag: OwnerTierTag } = $props();
</script>

<span class="tier-badge" role="img" title={tierTitle(tag)} aria-label={tierTitle(tag)} data-tier={tag.tier}>
  <TierCrest tier={tag.tier} size={44} />
</span>
