<script lang="ts">
  import { onMount } from 'svelte';
  import type { SheetView } from '@offside/app-core/sheets';
  import { RUNNER_SIZE, runnerDuration, canRun } from '@offside/app-core/avatarStage';
  import { sheetState } from './sheetState.svelte';
  import AvatarStage from './sheets/AvatarStage.svelte';

  const { v }: { v: Extract<SheetView, { kind: 'steps' | 'block' }> } = $props();
  let host: HTMLDivElement;
  let bounds = $state({ left: 0, top: 0, width: 0 });
  let reduced = $state(false);
  const shown = $derived(sheetState.open && sheetState.busy && sheetState.buttons.length === 0);
  const running = $derived(!!v.avatar && canRun(v.avatar, !reduced));
  const travel = $derived(Math.max(0, bounds.width - RUNNER_SIZE));

  onMount(() => {
    // The decoration follows the real sheet, outside its scrolling/clipped body.
    const root = host.closest<HTMLElement>('[data-progress-runner-root]')!;
    document.body.append(root);
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => reduced = media.matches;
    change();
    media.addEventListener('change', change);
    let raf: number;
    const follow = () => {
      if (!shown) return;
      const sheet = document.getElementById('sheet');
      if (sheet) {
        const r = sheet.getBoundingClientRect();
        const next = { left: r.left + 12, top: r.top - RUNNER_SIZE * 9 / 8 + 3, width: Math.max(0, r.width - 24) };
        if (next.left !== bounds.left || next.top !== bounds.top || next.width !== bounds.width) bounds = next;
      }
      raf = requestAnimationFrame(follow);
    };
    follow();
    return () => {
      cancelAnimationFrame(raf);
      media.removeEventListener('change', change);
      root.remove();
    };
  });
</script>

<div bind:this={host} class="runner-root" data-progress-runner-root>
  {#if shown && bounds.width && v.avatar}
    <div class="progress-runner" data-progress-runner aria-hidden="true"
      style:left="{bounds.left}px" style:top="{bounds.top}px" style:width="{bounds.width}px"
      style:--travel="{travel}px" style:--duration="{runnerDuration(travel)}ms">
      <div class="runner-player" class:running><div class="runner-facing" class:running>
        <AvatarStage spec={v.avatar} active={running} />
      </div></div>
    </div>
  {/if}
</div>

<style>
  .runner-root { display: contents; }
  .progress-runner { position: fixed; z-index: 11; height: 63px; pointer-events: none; background: transparent; }
  .runner-player, .runner-facing { width: 56px; height: 63px; }
  .runner-player.running:has(:global([data-motion="run"])) { animation: travel var(--duration) linear infinite; }
  .runner-facing.running:has(:global([data-motion="run"])) { animation: facing var(--duration) step-end infinite; }
  @keyframes travel { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(var(--travel)); } }
  @keyframes facing { 0%, 100% { transform: scaleX(1); } 50% { transform: scaleX(-1); } }
  @media (prefers-reduced-motion: reduce) { .running { animation: none !important; } }
</style>
