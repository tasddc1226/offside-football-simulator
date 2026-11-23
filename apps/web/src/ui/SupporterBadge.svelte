<!-- T-11-818 서포터 뱃지(클럽 멤버십 연속 구독 단계 1 · 3 · 6 · 9개월). 구독 중이 아니면 아무것도 그리지 않는다. -->
<script lang="ts">
  import type { SupporterTier } from '@offside/contracts/membership';
  import { supporterPill } from '@offside/app-core/supporter';

  let {
    tier,
    member = false,
    class: cls = '',
    ...rest
  }: { tier?: SupporterTier | null | undefined; member?: boolean; class?: string; [k: string]: unknown } = $props();
  const pill = $derived(supporterPill(tier, member));
</script>

{#if pill}<span {...rest} class="pill sup-badge {cls}" data-supporter={pill.tier} title={pill.label} aria-label={pill.label}>{pill.text}</span>{/if}
