<script lang="ts">
  import type { SheetView } from '@offside/app-core/sheets';
  // T-11-191 무대(모션 그림)는 첫 화면 청크에 넣지 않는다 — 시트가 열릴 때 불러온다.
  const stage = () => import('./AvatarStage.svelte');
  let { v }: { v: Extract<SheetView, { kind: 'steps' }> } = $props();
</script>

{#if v.avatar}{#await stage()}<div class="avatar-stage"></div>{:then m}<m.default spec={v.avatar} />{/await}{/if}
<div class="eyebrow">{v.title}</div>
<div class="prog"><i style:width="{v.progress * 100}%" style:transition-duration="{v.fill}ms"></i></div>
<div class="steps">
  {#each v.steps as t, i (i)}
    <div class:on={i === v.active} class:done={i < v.active}>{t}</div>
  {/each}
</div>
