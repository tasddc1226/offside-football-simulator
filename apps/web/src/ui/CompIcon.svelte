<script lang="ts">
  import CompIconView from './CompIconView.svelte';
  import CompIconSheet from './CompIconSheet.svelte';
  import { dismissCompIconHint } from './compIcons.svelte.js';

  let { ko, size = 24, still = false }: { ko: string; size?: number; still?: boolean } = $props();
  let open = $state(false);
  function show() {
    dismissCompIconHint();
    open = true;
  }
</script>

<CompIconView {ko} {size} onshow={still ? undefined : show} />
{#if open}<CompIconSheet {ko} onclose={() => (open = false)} />{/if}
