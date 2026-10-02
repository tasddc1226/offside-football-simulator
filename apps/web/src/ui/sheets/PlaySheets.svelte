<script lang="ts">
  // T-10-104: 게임 플레이 중에만 뜨는 시트 본문(이벤트·이벤트 결과·시즌 결산·이적시장·계약서·이적 비행). 선택지가 actions.ts →
  // 게임 엔진을 끌어오므로 홈 화면의 간단한 시트(안내·확인)와 청크를 나눈다 — SheetBody가 처음 필요할 때 불러온다.
  import Contract from './Contract.svelte';
  import EventChoice from './EventChoice.svelte';
  import EventResult from './EventResult.svelte';
  import Flight from './Flight.svelte';
  import Market from './Market.svelte';
  import SeasonResult from './SeasonResult.svelte';
  import type { GameSheetView } from './gameSheets.svelte.js';

  let { v }: { v: GameSheetView } = $props();
</script>

{#if v.kind === 'event'}<EventChoice {v} />
{:else if v.kind === 'eventResult'}<EventResult {v} />
{:else if v.kind === 'season'}<SeasonResult {v} />
{:else if v.kind === 'contract'}<Contract {v} />
{:else if v.kind === 'flight'}<Flight {v} />
{:else}<Market {v} />
{/if}
