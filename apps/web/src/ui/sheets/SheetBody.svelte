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
{:else if v.kind === 'event'}<EventChoice {v} />
{:else if v.kind === 'eventResult'}<EventResult {v} />
{:else if v.kind === 'season'}<SeasonResult {v} />
{:else if v.kind === 'market'}<Market {v} />
{:else}<Notice {v} />
{/if}
