<script lang="ts">
  // T-11-128 구단주 티어(시즌 휘장) 작은 표시 — 날개 문장 + 티어 이름 알약. 댓글 · 채팅 닉네임 옆에 붙는다.
  import { TIER_PALETTE } from '@offside/app-core/tierCrest';
  import { tierName, tierTitle, type OwnerTierTag } from '@offside/app-core/ownerTier';
  import TierCrest from './TierCrest.svelte';

  let { tag }: { tag: OwnerTierTag } = $props();
  const c = $derived(TIER_PALETTE[tag.tier]);
</script>

<span class="tier-badge" style="--tier: {c.base}; --tier-hi: {c.hi}" title={tierTitle(tag)} data-tier={tag.tier}>
  <TierCrest tier={tag.tier} size={30} />
  <span class="tier-name">{tierName(tag.tier)}</span>
</span>
