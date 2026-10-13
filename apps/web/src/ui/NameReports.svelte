<script lang="ts">
  // T-11-237 화면 맨 아래 신고 버튼 줄 — 구단 화면은 구단 이름·구단주 닉네임을 한 줄에 · 로 잇는다.
  import type { Snippet } from 'svelte';

  const { children }: { children: Snippet } = $props();
</script>

<p class="name-reports">{@render children()}</p>

<style>
  .name-reports {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    margin: 12px 0 0;
  }
  .name-reports :global(.name-report + .name-report)::before {
    content: '·';
    margin-right: 16px;
    color: var(--muted);
  }
</style>
