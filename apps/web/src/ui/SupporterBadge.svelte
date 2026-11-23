<!-- T-11-818 서포터 뱃지(클럽 멤버십 연속 구독 단계 1 · 3 · 6 · 9개월). T-11-819부터 별 방패 휘장을 붙인다. 좁은 줄(compact)은
     휘장만, 넓은 곳은 휘장 + "서포터 N개월" 글자. 구독 중이 아니면 아무것도 그리지 않는다. -->
<script lang="ts">
  import type { SupporterTier } from '@offside/contracts/membership';
  import { supporterPill } from '@offside/app-core/supporter';
  import SupporterCrest from './SupporterCrest.svelte';

  let {
    tier,
    member = false,
    compact = false,
    class: cls = '',
    ...rest
  }: {
    tier?: SupporterTier | null | undefined;
    member?: boolean;
    compact?: boolean;
    class?: string;
    [k: string]: unknown;
  } = $props();
  const pill = $derived(supporterPill(tier, member));
</script>

{#if pill}<span {...rest} class="sup-badge {cls}" class:compact data-supporter={pill.tier} title={pill.label} aria-label={pill.label} role="img"><SupporterCrest tier={pill.tier} size={compact ? 16 : 18} />{#if !compact}<span class="sup-text" aria-hidden="true">{pill.text}</span>{/if}</span>{/if}
