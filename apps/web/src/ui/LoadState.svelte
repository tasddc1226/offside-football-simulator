<script lang="ts" module>
  export type LoadStatus = 'loading' | 'ready' | 'error';
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { shellText as L } from '@offside/app-core/i18n/ko/shell';
  import { shellMoreText } from '@offside/app-core/i18n/ko/shellMore';

  // 목록 화면의 불러오는 중 / 실패 + 다시 시도 / 내용. failText: '댓글을 불러오지 못했어요.'처럼 문장 그대로.
  let { status, failText, retry, children }: { status: LoadStatus; failText: string; retry: () => void; children: Snippet } = $props();
</script>

{#if status === 'loading'}
  <p class="muted" aria-live="polite">{L.loading}</p>
{:else if status === 'error'}
  <div class="stack" style="gap:8px">
    <p class="muted" style="margin:0">{failText}</p>
    <button class="icon-btn self-start" onclick={() => retry()}>{shellMoreText.retry}</button>
  </div>
{:else}
  {@render children()}
{/if}
