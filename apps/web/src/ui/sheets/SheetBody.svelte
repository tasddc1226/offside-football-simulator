<script lang="ts">
  import Block from './Block.svelte';
  import Judge from './Judge.svelte';
  import Notice from './Notice.svelte';
  import Steps from './Steps.svelte';
  import { gameSheets, isGameSheet, loadGameSheets } from './gameSheets.svelte.js';
  import type { SheetView } from '@offside/app-core/sheets';

  let { v }: { v: SheetView } = $props();

  // T-10-104: 이벤트·결산·이적시장 본문은 게임 청크라 처음 필요할 때 불러온다(보통은 게임 화면이 미리 불러 둔다).
  // 아직 안 왔으면 본문 없이 버튼만 보이다가 오는 대로 나타난다.
  $effect(() => {
    if (isGameSheet(v) && !gameSheets.C) void loadGameSheets().catch(() => {});
  });
</script>

{#if v.kind === 'steps'}<Steps {v} />
{:else if v.kind === 'block'}<Block {v} />
{:else if v.kind === 'judge'}<Judge {v} />
{:else if v.kind === 'achieve'}
  <!-- T-11-034 업적 달성 알림은 가끔 뜨는 시트라 엠블럼과 함께 첫 화면 번들 밖에서 불러온다. -->
  {#await import('./Achieve.svelte') then { default: Achieve }}<Achieve {v} />{/await}
{:else if v.kind === 'minigame'}
  <!-- T-10-089 미니게임 장면은 몇몇 선택지에서만 쓰여 첫 화면 번들 밖에 둔다(playMinigame이 미리 불러 둔다). -->
  {#await import('./Minigame.svelte') then { default: Minigame }}<Minigame {v} />{/await}
{:else if v.kind === 'dragShot'}
  <!-- T-10-089 드래그 슛은 프로토타입(연습용)이라 첫 화면 번들 밖에서 불러온다. -->
  {#await import('./DragShot.svelte') then { default: DragShot }}<DragShot {v} />{/await}
{:else if isGameSheet(v)}
  {#if gameSheets.C}<gameSheets.C {v} />{/if}
{:else}<Notice {v} />
{/if}
