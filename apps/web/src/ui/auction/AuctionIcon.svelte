<script lang="ts">
  // T-11-735 소장품 아이콘 — app-core 선 그림을 등급색(currentColor)으로 그린다.
  const { d, size = 28 }: { d: string; size?: number } = $props();
</script>

<svg class="auction-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path {d} /></svg>

<style>
  .auction-icon {
    display: block;
    flex: none;
  }
</style>
