<script lang="ts" module>
  export type LoadStatus = 'loading' | 'ready' | 'error';
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { shellMoreText } from '@offside/app-core/i18n/ko/shellMore';
  import Skeleton from './Skeleton.svelte';

  // 목록 화면의 불러오는 중(뼈대, T-11-389) / 실패 + 다시 시도 / 내용. failText: '댓글을 불러오지 못했어요.'처럼 문장 그대로.
  // rows: 뼈대 줄 수(내용과 비슷하게).
  let {
    status,
    failText,
    retry,
    rows = 3,
    children,
  }: { status: LoadStatus; failText: string; retry: () => void; rows?: number; children: Snippet } = $props();
</script>

{#if status === 'loading'}
  <Skeleton {rows} />
{:else if status === 'error'}
  <div class="stack" style="gap:8px">
    <p class="muted" style="margin:0">{failText}</p>
    <button class="icon-btn self-start" onclick={() => retry()}>{shellMoreText.retry}</button>
  </div>
{:else}
  {@render children()}
{/if}
