<script lang="ts">
  // T-10-029 숫자 카운트업 — 처음 그려질 때 0에서 value까지 올라간다. 감속 모션이면 바로 value.
  // animate=false면 그냥 value를 그린다(명예의 전당 상세처럼 연출이 필요 없는 곳).
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { dur } from './motion.js';

  let { value, animate = true, decimals = 0, ms = 1200 }: { value: number; animate?: boolean; decimals?: number; ms?: number } = $props();
  // 마운트 때 한 번만 목표를 준다(리포트는 다시 그려지지 않는다).
  // svelte-ignore state_referenced_locally
  const t = new Tween(animate ? 0 : value, { duration: dur(ms), easing: cubicOut });
  $effect(() => {
    t.target = value;
  });
</script>

{t.current.toFixed(decimals)}
