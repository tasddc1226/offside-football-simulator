<script lang="ts">
  import Chips from './Chips.svelte';
  import type { SheetView } from './types.js';
  let { v }: { v: Extract<SheetView, { kind: 'eventResult' }> } = $props();
</script>

<div class="eyebrow">결과 · {v.label}</div>
<div class="result-big pop {v.ok ? 'ok' : 'ng'}">{v.outcome}</div>
<p>{v.text}</p>
<Chips chips={v.chips} pop />
{#if v.twist}<p class="twist">{v.twist}</p>{/if}
{#if v.story}
  {#if v.story.ending}
    <div class="story-end"><span class="eyebrow">스토리 완결 · {v.story.name}</span><b>{v.story.ending}</b></div>
  {:else}
    <div class="story-next">
      {#if v.story.started}새 스토리 시작: <b>{v.story.name}</b> — {/if}이 이야기는 다음에 이어집니다…
    </div>
  {/if}
{/if}
