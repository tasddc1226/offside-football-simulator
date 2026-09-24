<script lang="ts">
  // ───────── 하단 탭바 SVG 아이콘 (T-10-003) ─────────
  // 기존 이모지(⚽🧑📋🏆)를 대체하는 stroke 아이콘 세트. currentColor를 써서 라이트/다크와
  // 활성 탭 색상(.tabs button[aria-selected="true"] { color: ... })을 그대로 상속한다.
  import type { Tab } from './state.svelte.js';

  const { name }: { name: Tab } = $props();
</script>

{#if name === 'season'}
  <svg class="tab-ic" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.2 15.7 9.8l-1.4 4.4H9.7L8.3 9.8Z" />
    <path d="M12 3v4.2M12 20.8V17M4.2 9l3.1 1M16.7 10l3.1-1M6.3 17.5l2.4-3.3M15.3 14.2l2.4 3.3" />
  </svg>
{:else if name === 'player'}
  <svg class="tab-ic" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="7.2" r="3.2" />
    <path d="M4.8 20c.9-3.6 3.8-5.8 7.2-5.8s6.3 2.2 7.2 5.8" />
  </svg>
{:else if name === 'career'}
  <svg class="tab-ic" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="4.5" y="3.5" width="15" height="17" rx="2" />
    <path d="M8.5 3.5v3h7v-3M8 10.5h8M8 14h8M8 17.5h5" />
  </svg>
{:else}
  <svg class="tab-ic" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M7 4h10v4a5 5 0 0 1-5 5 5 5 0 0 1-5-5Z" />
    <path d="M7 5H4.5a1 1 0 0 0-1 1c0 2.6 1.6 4.3 3.6 4.7M17 5h2.5a1 1 0 0 1 1 1c0 2.6-1.6 4.3-3.6 4.7" />
    <path d="M12 13v3.5M9 20.5h6M9.5 20.5c0-1.7.9-2.7 2.5-2.7s2.5 1 2.5 2.7" />
  </svg>
{/if}
