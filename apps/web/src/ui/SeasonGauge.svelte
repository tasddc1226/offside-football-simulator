<script lang="ts">
  // 시즌 진행 게이지(홈). 시즌은 정한 날짜가 아니라 유저들이 끝까지 뛴 커리어로 찬다(contracts season-gauge.ts).
  // 90%에 닿아 마감이 정해지면 카운트다운으로 바뀐다. 진행 중인 시즌이 없으면 아무것도 그리지 않는다.
  import { onMount } from 'svelte';
  import { seasonGaugeInfo, seasonGaugeLines, type SeasonGauge } from '@offside/app-core/seasonGauge';
  import { seasonGaugeText as T } from '@offside/app-core/i18n/ko/seasonGauge';
  import PopSheet from './PopSheet.svelte';
  import { loadSeasonGauge } from '@offside/app-core/seasonSchedule';

  let gauge = $state.raw<SeasonGauge | null>(null);
  let now = $state(Date.now());
  const lines = $derived(gauge ? seasonGaugeLines(gauge, now) : null);
  // T-11-435 카드를 누르면 게이지가 무엇을 세는지 · 마감 · 진행 중 커리어 · 보상 위치를 알려 주는 창을 연다.
  let open = $state(false);

  async function load() {
    const r = await loadSeasonGauge();
    if (r.ok) gauge = r.data.gauge;
    now = Date.now();
  }

  onMount(() => {
    void load();
    // 서버는 30분마다 세고 엣지는 5분 담는다. 카운트다운은 분 단위라 30초마다 시계만 다시 본다.
    const poll = setInterval(() => void load(), 5 * 60_000);
    const tick = setInterval(() => (now = Date.now()), 30_000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  });
</script>

{#if gauge && lines}
  <section class="card season-gauge" class:locked={!!gauge.endsAt} data-season-gauge aria-label={lines.aria}>
    <button class="tap-cover" data-act="season-gauge-info" aria-haspopup="dialog" aria-label={T.openLabel({ aria: lines.aria })} onclick={() => (open = true)}></button>
    <div class="sg-head">
      <span class="eyebrow sg-eyebrow">Season progress<svg class="sg-info" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg></span>
      <b class="sg-pct num" data-season-gauge-pct>{lines.pct}%</b>
    </div>
    <h2 class="sg-title">{lines.countdown ?? lines.title}</h2>
    <div class="sg-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={lines.pct} aria-label={lines.aria}>
      <i style:width="{lines.pct}%"></i><span class="sg-lock" aria-hidden="true"></span>
    </div>
    {#if lines.endDate}<p class="sg-date" data-season-gauge-date>{lines.endDate}</p>{/if}
    {#if lines.why}<p class="sg-date" data-season-gauge-why>{lines.why}</p>{/if}
  </section>
{/if}

{#if open}
  <PopSheet label={T.infoTitle} onclose={() => (open = false)}>
    <div class="sg-info-sheet" data-season-gauge-sheet>
      <div>
        <small class="eyebrow">Season progress</small>
        <h2>{T.infoTitle}</h2>
      </div>
      {#each seasonGaugeInfo() as part (part.head)}
        <section>
          <h3>{part.head}</h3>
          <p>{part.body}</p>
        </section>
      {/each}
      <button class="btn btn-block" data-act="season-gauge-info-close" onclick={() => (open = false)}>{T.infoClose}</button>
    </div>
  </PopSheet>
{/if}

<style>
  .season-gauge {position:relative;display:flex;flex-direction:column;gap:8px;}
  .sg-eyebrow {display:inline-flex;align-items:center;gap:4px;}
  .sg-info {width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;}
  .sg-info-sheet {display:flex;flex-direction:column;gap:12px;}
  .sg-info-sheet h2 {margin:0;font-size:var(--fs-title3);}
  .sg-info-sheet h3 {margin:0 0 4px;font-size:var(--fs-body);}
  .sg-info-sheet p {margin:0;font-size:var(--fs-label);color:var(--muted);line-height:1.55;}
  .sg-head {display:flex;align-items:baseline;justify-content:space-between;gap:8px;}
  .sg-pct {font-family:var(--display);font-size:var(--fs-title1);line-height:1;color:var(--accent-text);}
  .sg-title {margin:0;font-size:var(--fs-title3);}
  .locked .sg-title {color:var(--accent-text);}
  .sg-date {margin:0;font-size:var(--fs-label);color:var(--muted);}
  .sg-bar {position:relative;height:12px;border-radius:var(--radius-pill);background:var(--surface-2);overflow:hidden;}
  .sg-bar i {position:absolute;inset:0 auto 0 0;border-radius:inherit;background:linear-gradient(90deg,color-mix(in srgb,var(--accent),transparent 35%),var(--accent));transition:width .6s ease-out;}
  /* 90%(마감이 정해지는 자리) 눈금 */
  .sg-lock {position:absolute;top:0;bottom:0;left:90%;width:2px;background:color-mix(in srgb,var(--ink),transparent 60%);}
  @media(prefers-reduced-motion:reduce) { .sg-bar i {transition:none;} }
</style>
