<script lang="ts">
  // T-11-128 시즌 휘장 — 티어 장식이 둘러싼 고리 가운데에 프로필(이니셜)이 들어간다(LoL 시즌 테두리처럼).
  // 조각 · 색은 app-core tierCrest.ts(앱과 공용). initial이 없으면 가운데를 보석 빛으로 채운다(댓글 · 채팅 작은 표시).
  import type { OwnerTier } from '@offside/contracts/owner-tier';
  import { CREST_RING, CREST_SLOT, CREST_VIEWBOX, TIER_PALETTE, crestShape, type CrestPart } from '@offside/app-core/tierCrest';

  let { tier, size = 160, initial }: { tier: OwnerTier; size?: number; initial?: string } = $props();
  const uid = $props.id();
  const shape = $derived(crestShape(tier));
  const c = $derived(TIER_PALETTE[tier]);
  const fill = (k: CrestPart['kind']) => (k === 'back' ? c.lo : k === 'gem' ? `url(#${uid}-g)` : `url(#${uid}-m)`);
</script>

{#snippet part(p: CrestPart)}
  <path d={p.d} fill={fill(p.kind)} stroke={p.kind === 'back' ? 'none' : c.lo} stroke-width="0.7" stroke-linejoin="round" />
{/snippet}

<span class="tier-crest" style="--crest-w: {size}px" data-crest={tier} aria-hidden="true">
  <svg viewBox={CREST_VIEWBOX} focusable="false">
    <defs>
      <linearGradient id="{uid}-m" x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0" stop-color={c.hi} />
        <stop offset="0.45" stop-color={c.base} />
        <stop offset="1" stop-color={c.lo} />
      </linearGradient>
      <radialGradient id="{uid}-g" cx="0.4" cy="0.3" r="0.8">
        <stop offset="0" stop-color="#ffffff" />
        <stop offset="0.35" stop-color={c.gem} />
        <stop offset="1" stop-color={c.base} />
      </radialGradient>
      <radialGradient id="{uid}-in" cx="0.5" cy="0.35" r="0.7">
        <stop offset="0" stop-color={c.lo} />
        <stop offset="1" stop-color="#0b100d" />
      </radialGradient>
    </defs>
    {#each shape.under as p, i (i)}{@render part(p)}{/each}
    <circle cx={CREST_SLOT.cx} cy={CREST_SLOT.cy} r={CREST_RING.outer} fill="url(#{uid}-m)" stroke={c.lo} stroke-width="0.9" />
    <circle cx={CREST_SLOT.cx} cy={CREST_SLOT.cy} r={CREST_RING.outer - 1.6} fill="none" stroke={c.hi} stroke-opacity="0.6" stroke-width="0.7" />
    <circle cx={CREST_SLOT.cx} cy={CREST_SLOT.cy} r={CREST_RING.inner + 0.8} fill="none" stroke={c.lo} stroke-width="1.2" />
    <circle cx={CREST_SLOT.cx} cy={CREST_SLOT.cy} r={CREST_RING.inner} fill={initial === undefined ? `url(#${uid}-g)` : `url(#${uid}-in)`} />
    {#each shape.over as p, i (i)}{@render part(p)}{/each}
  </svg>
  {#if initial !== undefined}<span class="tier-crest-avatar" style="color: {c.hi}">{initial}</span>{/if}
</span>
