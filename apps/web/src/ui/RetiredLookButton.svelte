<script lang="ts">
  // T-11-439 남은 횟수를 버튼에 쓰고, 이번 접속에서 이미 확인한 잠김(사용함 · 이적시장 거래)이면 누를 수 없게 한다.
  // 잠김은 편집기가 열 때 받은 정책을 기억해 둔 값이라 버튼만을 위해 서버를 부르지 않는다.
  import type { LegendView } from '@offside/app-core/state';
  import { lookButtonLabel, retiredLookLockOf } from '@offside/app-core/retiredLookLock';
  const { v }: { v: LegendView } = $props();
  let open = $state(false);
  // 쓰기 가능한 derived: 다른 선수로 바뀌면 다시 읽고, 편집기를 닫으면 방금 확인한 값으로 바꾼다.
  let lock = $derived(retiredLookLockOf(v));
  let button: HTMLButtonElement;
  function close() {
    open = false;
    lock = retiredLookLockOf(v);
    if (lock) return;
    button?.focus({ preventScroll: true });
  }
</script>

<button bind:this={button} class="btn" data-act="retired-look" data-look-lock={lock ?? undefined} disabled={!!lock} onclick={() => open = true}>{lookButtonLabel(lock)}</button>
{#if open}
  {#await import('./RetiredLook.svelte') then { default: Editor }}
    <Editor {v} onclose={close} />
  {/await}
{/if}
