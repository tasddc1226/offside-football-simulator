<script lang="ts" generics="T">
  // API 결과 한 칸: 기다리는 동안 뼈대, 실패면 이유, 성공이면 children(data). 401 · 403은 App이 화면 전체로 보인다.
  import type { Snippet } from 'svelte';
  import type { ApiResult } from '../api.ts';

  let {
    r,
    height = 160,
    children,
  }: {
    r: ApiResult<T> | null;
    height?: number;
    children: Snippet<[T]>;
  } = $props();
</script>

{#if r === null}
  <div class="sk" style:height={`${height}px`} aria-busy="true"></div>
{:else if !r.ok}
  <div class="err">
    불러오지 못했어요. ({r.message}) 위 새로고침으로 다시 시도해 주세요.
  </div>
{:else}
  {@render children(r.data)}
{/if}

<style>
  .sk {
    border-radius: 12px;
    background: linear-gradient(90deg, var(--surface) 0%, var(--grid) 50%, var(--surface) 100%);
    background-size: 200% 100%;
    animation: sk 1.4s ease-in-out infinite;
    border: 1px solid var(--border);
  }
  @keyframes sk {
    to {
      background-position: -200% 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .sk {
      animation: none;
    }
  }
  .err {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 18px;
    color: var(--text-2);
    font-size: 13px;
  }
</style>
