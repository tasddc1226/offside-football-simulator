<script lang="ts" module>
  export type LoadStatus = 'loading' | 'ready' | 'error';
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';

  // 목록 화면의 불러오는 중 / 실패 + 다시 시도 / 내용. failText: '댓글을 불러오지 못했어요.'처럼 문장 그대로.
  let { status, failText, retry, children }: { status: LoadStatus; failText: string; retry: () => void; children: Snippet } = $props();
</script>

{#if status === 'loading'}
  <p class="muted" aria-live="polite">불러오는 중…</p>
{:else if status === 'error'}
  <div class="stack" style="gap:8px">
    <p class="muted" style="margin:0">{failText}</p>
    <button class="icon-btn" style="align-self:flex-start" onclick={() => retry()}>다시 시도</button>
  </div>
{:else}
  {@render children()}
{/if}
