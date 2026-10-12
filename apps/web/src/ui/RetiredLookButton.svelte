<script lang="ts">
  import type { LegendView } from '@offside/app-core/state';
  import { avatarLookText as L } from '@offside/app-core/i18n/ko/avatarLook';
  const { v }: { v: LegendView } = $props();
  let open = $state(false);
  let button: HTMLButtonElement;
  function close() {
    open = false;
    button?.focus({ preventScroll: true });
  }
</script>

<button bind:this={button} class="btn" data-act="retired-look" onclick={() => open = true}>{L.chip}</button>
{#if open}
  {#await import('./RetiredLook.svelte') then { default: Editor }}
    <Editor {v} onclose={close} />
  {/await}
{/if}
