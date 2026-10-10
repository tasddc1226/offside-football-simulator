<script lang="ts">
  // T-10-130 화면 아래에 고정된 버튼 바(공유 바·이전으로 바가 함께 쓴다). 본문이 바에 가리지 않게 같은 높이의 빈 칸을
  // 두고, 바 위에 띄우는 버튼(커리어 재생)이 쓰도록 높이를 --bottom-bar-h 로 알린다. 탭바가 있는 화면(기록실)에서는
  // 탭바 위에 붙는다(atBottom=false). inline이면 본문 안에서 표시한다.
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  const { children, atBottom = true, inline = false, ...rest }: { children: Snippet; atBottom?: boolean; inline?: boolean } & HTMLAttributes<HTMLDivElement> = $props();
  let h = $state(0);
  $effect(() => {
    if (inline) return;
    document.documentElement.style.setProperty('--bottom-bar-h', `${h}px`);
    return () => document.documentElement.style.removeProperty('--bottom-bar-h');
  });
</script>

{#if inline}
  <div {...rest} class="stack" data-inline-actions>{@render children()}</div>
{:else}
  <div class="action-bar-space" style:height="{h}px" aria-hidden="true"></div>
  <div {...rest} class="action-bar" class:at-bottom={atBottom} bind:clientHeight={h}>
    <div class="action-bar-inner stack">{@render children()}</div>
  </div>
{/if}
