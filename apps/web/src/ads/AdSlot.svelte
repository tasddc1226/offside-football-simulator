<script lang="ts">
  // T-11-061 광고 칸. 위치 이름만 받고 노출 규칙은 adPolicy가 정한다. 목록·페이지 맨 끝에만 둔다.
  import { untrack } from 'svelte';
  import { shouldShow, type AdPlace } from '@offside/app-core/adPolicy';
  import { sheetOn } from '../ui/skin.svelte.js';
  import { client, enabled, lastShownOf, markUnfilled, preview, request, slotOf } from './ads.js';

  let props: { place: AdPlace } = $props();
  // 위치와 노출 여부는 마운트할 때 한 번 정한다 — 화면에 있는 동안 칸이 생기거나 사라지지 않게.
  const place = untrack(() => props.place);
  const slot = slotOf(place);
  const show = shouldShow(place, Date.now(), lastShownOf(place)) && (preview || (enabled() && !!slot));
  const live = show && !preview;
  let collapsed = $state(false);
  // 채우지 못한 칸은 접고 이 세션에서 다시 요청하지 않는다.
  function collapse() {
    markUnfilled(place);
    collapsed = true;
  }
  let ins = $state<HTMLElement>();

  $effect(() => {
    const el = ins;
    if (!live || !el) return;
    // 칸이 화면 근처에 올 때 한 번만 요청한다.
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        void request(place, el).then((ok) => {
          if (!ok) collapse();
        });
      },
      { rootMargin: '200px' },
    );
    io.observe(el);
    // AdSense가 채우지 못하면 data-ad-status="unfilled"를 단다.
    const mo = new MutationObserver(() => {
      if (el.dataset.adStatus === 'unfilled') collapse();
    });
    mo.observe(el, { attributes: true, attributeFilter: ['data-ad-status'] });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  });
</script>

{#if show && !collapsed && !sheetOn()}
  <aside class="ad-slot" aria-label="광고" data-ad-place={place}>
    <span class="ad-label">광고</span>
    {#if live}
      <ins
        bind:this={ins}
        class="adsbygoogle"
        style="display:block"
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      ></ins>
    {:else}
      <div class="ad-preview">광고 자리 · {place}</div>
    {/if}
  </aside>
{/if}

<style>
  .ad-slot {
    margin: 28px 0 8px;
    display: grid;
    gap: 6px;
  }
  .ad-label {
    font-size: 0.6875rem;
    letter-spacing: 0.04em;
    color: var(--muted);
  }
  .ad-slot :global(.adsbygoogle),
  .ad-preview {
    min-height: 100px;
    border-radius: 12px;
  }
  .ad-preview {
    display: grid;
    place-items: center;
    border: 1px dashed var(--line);
    color: var(--muted);
    font-size: 0.8125rem;
  }
</style>
