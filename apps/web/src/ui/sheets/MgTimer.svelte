<script lang="ts">
  // T-10-089 미니게임 제한 시간. 장면이 뜨면 줄어드는 막대와 남은 초를 보여 주고, 시간이 다 되면 onexpire를
  // 부른다(부른 쪽이 실패로 처리). 누르거나 차면(stopped) 그 자리에서 멈춘다.
  import { MG_TIME_MS } from '@offside/game/minigame';

  let { stopped, onexpire }: { stopped: boolean; onexpire: () => void } = $props();

  let left = $state(Math.ceil(MG_TIME_MS / 1000));
  // 남은 초가 바뀌는 순간(j초 남음)마다 타이머 하나. 멈추면 effect가 다시 돌며 남은 타이머를 거둔다.
  $effect(() => {
    if (stopped) return;
    const ids = Array.from({ length: Math.ceil(MG_TIME_MS / 1000) }, (_, j) =>
      setTimeout(() => {
        left = j;
        if (!j) onexpire();
      }, MG_TIME_MS - j * 1000),
    );
    return () => ids.forEach(clearTimeout);
  });
</script>

<span class="mg-timer" class:stop={stopped} class:hurry={left <= 1} style="--mg-time:{MG_TIME_MS}ms" aria-hidden="true">
  <i></i><b>{left}</b>
</span>
