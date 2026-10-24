<script lang="ts">
  // T-11-061 광고 칸. 위치 이름만 받고 노출 규칙은 adPolicy가 정한다. 승인된 위치에 본문과 함께 스크롤되는 칸을 둔다.
  // T-11-480 AdSense 단위가 없는 위치는 카카오 애드핏 배너(한국어 화면)로 채운다.
  import { untrack } from 'svelte';
  import { shouldShow, type AdPlace } from '@offside/app-core/adPolicy';
  import { sheetOn } from '../ui/skin.svelte.js';
  import { client, enabled, lastShownOf, markShown, markUnfilled, onHost, preview, request, slotOf } from './ads.js';
  import { ADFIT_FAIL, ADFIT_FAIL_EVENT, ADFIT_HEIGHT, ADFIT_WIDTH, adfitUnitOf, requestAdfit } from './adfit.js';
  import { shellMoreText } from '@offside/app-core/i18n/ko/shellMore';

  let props: { place: AdPlace } = $props();
  // 위치와 노출 여부는 마운트할 때 한 번 정한다 — 화면에 있는 동안 칸이 생기거나 사라지지 않게.
  const place = untrack(() => props.place);
  const slot = enabled() ? slotOf(place) : undefined;
  const unit = slot || !onHost() ? undefined : adfitUnitOf(place);
  const show = shouldShow(place, Date.now(), lastShownOf(place)) && (preview || !!slot || !!unit);
  const live = show && !preview;
  let collapsed = $state(false);
  // 채우지 못한 칸은 접고 이 세션에서 다시 요청하지 않는다.
  function collapse() {
    markUnfilled(place);
    collapsed = true;
  }
  let ins = $state<HTMLElement>();
  let box = $state<HTMLElement>();

  $effect(() => {
    const el = ins;
    if (!live || !el || !box) return;
    // 칸이 화면 근처에 올 때 한 번만 요청한다. 애드핏 칸은 채워지기 전까지 숨어 있어 감싼 칸을 지켜본다.
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        if (unit) markShown(place);
        void (unit ? requestAdfit(el) : request(place, el)).then((ok) => {
          if (!ok) collapse();
        });
      },
      { rootMargin: '200px' },
    );
    io.observe(box);
    // AdSense가 채우지 못하면 data-ad-status="unfilled"를 달고, 애드핏은 칸에 실패 이벤트를 보낸다.
    const mo = new MutationObserver(() => {
      if (el.dataset.adStatus === 'unfilled') collapse();
    });
    mo.observe(el, { attributes: true, attributeFilter: ['data-ad-status'] });
    el.addEventListener(ADFIT_FAIL_EVENT, collapse);
    return () => {
      io.disconnect();
      mo.disconnect();
      el.removeEventListener(ADFIT_FAIL_EVENT, collapse);
    };
  });
</script>

{#if show && !collapsed && !sheetOn()}
  <aside bind:this={box} class="ad-slot" class:owner-summary={place === 'owner-summary'} aria-label={shellMoreText.adLabel} data-ad-place={place}>
    <span class="ad-label">{shellMoreText.adLabel}</span>
    {#if live && unit}
      <ins
        bind:this={ins}
        class="kakao_ad_area adfit"
        style="display:none"
        data-ad-unit={unit}
        data-ad-width={ADFIT_WIDTH}
        data-ad-height={ADFIT_HEIGHT}
        data-ad-onfail={ADFIT_FAIL}
      ></ins>
    {:else if live}
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
      <div class="ad-preview">{shellMoreText.adPreview({ place })}</div>
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
  .owner-summary {
    margin-bottom: 24px;
  }
  .ad-slot :global(.adsbygoogle),
  .ad-preview {
    min-height: 100px;
    border-radius: 12px;
  }
  /* 애드핏은 고정 크기 배너라 가운데에 둔다. */
  .ad-slot :global(.adfit) {
    margin: 0 auto;
  }
  .ad-preview {
    display: grid;
    place-items: center;
    border: 1px dashed var(--line);
    color: var(--muted);
    font-size: 0.8125rem;
  }
</style>
