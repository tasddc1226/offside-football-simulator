<script lang="ts">
  // T-11-128 시즌 휘장 — 티어 날개 문장 가운데에 프로필(이니셜)이 들어간다(LoL 지난 시즌 티어 테두리처럼).
  // 좌표 · 색은 app-core tierCrest.ts(앱과 공용). initial이 없으면 가운데를 비우고 보석 빛으로 채운다(작은 표시용).
  import type { OwnerTier } from '@offside/contracts/owner-tier';
  import { CREST_RING, CREST_SLOT, CREST_VIEWBOX, TIER_PALETTE, crestShape } from '@offside/app-core/tierCrest';

  let { tier, size = 160, initial }: { tier: OwnerTier; size?: number; initial?: string } = $props();
  const uid = $props.id();
  const shape = $derived(crestShape(tier));
  const c = $derived(TIER_PALETTE[tier]);
</script>

<span class="tier-crest" style="--crest-w: {size}px" data-crest={tier} aria-hidden="true">
  <svg viewBox={CREST_VIEWBOX} focusable="false">
    <defs>
      <linearGradient id="{uid}-m" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color={c.hi} />
        <stop offset="0.5" stop-color={c.base} />
        <stop offset="1" stop-color={c.lo} />
      </linearGradient>
      <radialGradient id="{uid}-g" cx="0.5" cy="0.4" r="0.6">
        <stop offset="0" stop-color={c.gem} />
        <stop offset="1" stop-color={c.base} />
      </radialGradient>
      <radialGradient id="{uid}-in" cx="0.5" cy="0.35" r="0.7">
        <stop offset="0" stop-color={c.lo} />
        <stop offset="1" stop-color="#0b100d" />
      </radialGradient>
    </defs>
    <path d={shape.wingsBack} fill={c.lo} opacity="0.9" />
    <path d={shape.wingsFront} fill="url(#{uid}-m)" stroke={c.lo} stroke-width="0.7" stroke-linejoin="round" />
    <path d={shape.crown} fill="url(#{uid}-m)" stroke={c.lo} stroke-width="0.7" stroke-linejoin="round" />
    <circle cx={CREST_SLOT.cx} cy={CREST_SLOT.cy} r={CREST_RING.outer} fill="url(#{uid}-m)" stroke={c.lo} stroke-width="0.8" />
    <circle cx={CREST_SLOT.cx} cy={CREST_SLOT.cy} r={CREST_RING.outer - 2.2} fill="none" stroke={c.hi} stroke-opacity="0.55" stroke-width="0.8" />
    <circle cx={CREST_SLOT.cx} cy={CREST_SLOT.cy} r={CREST_RING.inner} fill={initial === undefined ? `url(#${uid}-g)` : `url(#${uid}-in)`} stroke={c.lo} stroke-width="1" />
    <path d={shape.gem} fill="url(#{uid}-g)" stroke={c.lo} stroke-width="0.7" />
  </svg>
  {#if initial !== undefined}<span class="tier-crest-avatar" style="color: {c.hi}">{initial}</span>{/if}
</span>
