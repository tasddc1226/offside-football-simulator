<script lang="ts">
  import { onMount } from 'svelte';
  import type { SheetView } from '@offside/app-core/sheets';
  import { RUNNER_SIZE, RUNNER_HEIGHT, GOAL_RECTS, GOAL_COLORS, GOAL_WIDTH, GOAL_HEIGHT, BALL_SIZE, runnerScene, canRun } from '@offside/app-core/avatarStage';
  import { sheetState } from './sheetState.svelte';
  import AvatarStage from './sheets/AvatarStage.svelte';

  const { v }: { v: Extract<SheetView, { kind: 'steps' | 'block' }> } = $props();
  let host: HTMLDivElement;
  let bounds = $state({ left: 0, top: 0, width: 0 });
  let reduced = $state(false);
  let ready = $state(false);
  let elapsed = $state(0);
  const onReady = (value: boolean) => ready = value;
  const shown = $derived(sheetState.open && sheetState.busy && sheetState.buttons.length === 0);
  const running = $derived(!!v.avatar && canRun(v.avatar, !reduced));
  const scene = $derived(runnerScene(bounds.width, elapsed, running && ready));

  onMount(() => {
    // The decoration follows the real sheet, outside its scrolling/clipped body.
    const root = host.closest<HTMLElement>('[data-progress-runner-root]')!;
    document.body.append(root);
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => reduced = media.matches;
    change();
    media.addEventListener('change', change);
    let raf: number;
    let started = 0;
    let playing = false;
    const follow = () => {
      if (!shown) return;
      const sheet = document.getElementById('sheet');
      if (sheet) {
        const r = sheet.getBoundingClientRect();
        const next = { left: r.left + 12, top: r.top - RUNNER_HEIGHT + 3, width: Math.max(0, r.width - 24) };
        // Native onLayout restarts after a width change; use the same rule here.
        if (next.width !== bounds.width) playing = false;
        if (next.left !== bounds.left || next.top !== bounds.top || next.width !== bounds.width) bounds = next;
      }
      const active = running && ready;
      if (active && !playing) started = performance.now();
      playing = active;
      if (active) elapsed = performance.now() - started;
      else if (elapsed) elapsed = 0;
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
    <div class="progress-runner" data-progress-runner data-phase={scene.phase} aria-hidden="true"
      style:left="{bounds.left}px" style:top="{bounds.top}px" style:width="{bounds.width}px" style:height="{RUNNER_HEIGHT}px">
      <div class="runner-player" style:width="{RUNNER_SIZE}px" style:height="{RUNNER_HEIGHT}px"
        style:transform="translateX({scene.x}px)" style:opacity={scene.playerOpacity}>
        <AvatarStage spec={v.avatar} active={running} motion={scene.motion} frame={scene.frame} {onReady} />
      </div>
      <svg class="goal" data-runner-goal width={GOAL_WIDTH} height={GOAL_HEIGHT} viewBox="0 0 34 34">
        {#each GOAL_RECTS as r, i (i)}<rect x={r[0]} y={r[1]} width={r[2]} height={r[3]}
          fill={r[4] ? GOAL_COLORS.net : scene.scored ? GOAL_COLORS.scored : GOAL_COLORS.frame} />{/each}
      </svg>
      <svg class="ball" data-runner-ball width={BALL_SIZE} height={BALL_SIZE} viewBox="0 0 8 8"
        style:transform="translate({scene.ballX}px, {scene.ballY}px)" style:opacity={scene.ballOpacity}>
        <circle cx="4" cy="4" r="3.5" fill="#f5f5ef" stroke="#202c24" stroke-width="1" />
        <path d="M3 2h2v2H3zM1 4h2v2H1zM5 5h2v2H5z" fill="#202c24" />
      </svg>
    </div>
  {/if}
</div>

<style>
  .runner-root { display: contents; }
  .progress-runner { position: fixed; z-index: 11; pointer-events: none; background: transparent; }
  .runner-player { position: absolute; left: 0; top: 0; }
  .goal { position: absolute; right: 0; bottom: 0; overflow: visible; shape-rendering: crispEdges; }
  .ball { position: absolute; left: 0; top: 0; }
</style>
