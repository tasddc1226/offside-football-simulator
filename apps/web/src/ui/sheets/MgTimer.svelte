<script lang="ts">
  // T-10-089 미니게임 제한 시간. 장면이 뜨면 줄어드는 막대와 남은 초를 보여 주고, 시간이 다 되면 onexpire를
  // 부른다(부른 쪽이 실패로 처리). 누르거나 차면(stopped) 그 자리에서 멈춘다.
  import { onMount } from 'svelte';
  import { MG_TIME_MS } from '../../game/minigame.js';

  let { stopped, onexpire }: { stopped: boolean; onexpire: () => void } = $props();

  let left = $state(Math.ceil(MG_TIME_MS / 1000));
  onMount(() => {
    const t0 = performance.now();
    const id = setInterval(() => {
      if (stopped) return clearInterval(id);
      const rest = MG_TIME_MS - (performance.now() - t0);
      left = Math.max(0, Math.ceil(rest / 1000));
      if (rest > 0) return;
      clearInterval(id);
      onexpire();
    }, 50);
    return () => clearInterval(id);
  });
</script>

<span class="mg-timer" class:stop={stopped} class:hurry={left <= 1} style="--mg-time:{MG_TIME_MS}ms" aria-hidden="true">
  <i></i><b>{left}</b>
</span>
