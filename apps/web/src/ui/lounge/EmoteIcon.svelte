<script lang="ts">
  // T-11-600 직접 그린 이모트를 버튼 아이콘으로 — 필드 캔버스와 같은 그림 함수를 쓴다.
  import { drawEmote, type IconKey } from '@offside/app-core/lounge/emotes';
  import { asCtx } from './canvas.js';

  let { name, size = 26 }: { name: IconKey; size?: number } = $props();
  let canvas: HTMLCanvasElement | undefined = $state();

  $effect(() => {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    drawEmote(asCtx(ctx), name, size / 2, size / 2, size);
  });
</script>

<canvas bind:this={canvas} style:width={`${size}px`} style:height={`${size}px`} aria-hidden="true"></canvas>

<style>
  canvas {
    display: block;
    pointer-events: none;
  }
</style>
