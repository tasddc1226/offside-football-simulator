<script lang="ts">
  // 시즌 진행 게이지(홈). 시즌은 정한 날짜가 아니라 유저들이 끝까지 뛴 커리어로 찬다(contracts season-gauge.ts).
  // 90%에 닿아 마감이 정해지면 카운트다운으로 바뀐다. 진행 중인 시즌이 없으면 아무것도 그리지 않는다.
  import { onMount } from 'svelte';
  import { seasonGaugeLines, type SeasonGauge } from '@offside/app-core/seasonGauge';
  import { loadSeasonGauge } from '@offside/app-core/seasonSchedule';
  import { num } from '@offside/app-core/teamText';

  let gauge = $state.raw<SeasonGauge | null>(null);
  let now = $state(Date.now());
  const lines = $derived(gauge ? seasonGaugeLines(gauge, now, num) : null);

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
    <div class="sg-head">
      <span class="eyebrow">Season progress</span>
      <b class="sg-pct num" data-season-gauge-pct>{lines.pct}%</b>
    </div>
    <h2 class="sg-title">{lines.countdown ?? lines.title}</h2>
    <div class="sg-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={lines.pct} aria-label={lines.aria}>
      <i style:width="{lines.pct}%"></i><span class="sg-lock" aria-hidden="true"></span>
    </div>
    <p class="sg-stats muted fs-sm num">{lines.stats}</p>
  </section>
{/if}

<style>
  .season-gauge {display:flex;flex-direction:column;gap:8px;}
  .sg-head {display:flex;align-items:baseline;justify-content:space-between;gap:8px;}
  .sg-pct {font-family:var(--display);font-size:1.5rem;line-height:1;color:var(--accent-text);}
  .sg-title {margin:0;font-size:1.0625rem;}
  .locked .sg-title {color:var(--accent-text);}
  .sg-bar {position:relative;height:12px;border-radius:999px;background:var(--surface-2);overflow:hidden;}
  .sg-bar i {position:absolute;inset:0 auto 0 0;border-radius:inherit;background:linear-gradient(90deg,color-mix(in srgb,var(--accent),transparent 35%),var(--accent));transition:width .6s ease-out;}
  /* 90%(마감이 정해지는 자리) 눈금 */
  .sg-lock {position:absolute;top:0;bottom:0;left:90%;width:2px;background:color-mix(in srgb,var(--ink),transparent 60%);}
  .sg-stats {margin:0;}
  @media(prefers-reduced-motion:reduce) { .sg-bar i {transition:none;} }
</style>
