<script lang="ts">
  import Block from './Block.svelte';
  import EventChoice from './EventChoice.svelte';
  import EventResult from './EventResult.svelte';
  import Judge from './Judge.svelte';
  import Market from './Market.svelte';
  import Notice from './Notice.svelte';
  import SeasonResult from './SeasonResult.svelte';
  import Steps from './Steps.svelte';
  import type { SheetView } from './types.js';

  let { v }: { v: SheetView } = $props();
</script>

{#if v.kind === 'steps'}<Steps {v} />
{:else if v.kind === 'block'}<Block {v} />
{:else if v.kind === 'judge'}<Judge {v} />
{:else if v.kind === 'minigame'}
  <!-- T-10-089 미니게임 장면은 몇몇 선택지에서만 쓰여 첫 화면 번들 밖에 둔다(playMinigame이 미리 불러 둔다). -->
  {#await import('./Minigame.svelte') then { default: Minigame }}<Minigame {v} />{/await}
{:else if v.kind === 'dragShot'}
  <!-- T-10-089 드래그 슛은 프로토타입(연습용)이라 첫 화면 번들 밖에서 불러온다. -->
  {#await import('./DragShot.svelte') then { default: DragShot }}<DragShot {v} />{/await}
{:else if v.kind === 'event'}<EventChoice {v} />
{:else if v.kind === 'eventResult'}<EventResult {v} />
{:else if v.kind === 'season'}<SeasonResult {v} />
{:else if v.kind === 'market'}<Market {v} />
{:else}<Notice {v} />
{/if}
