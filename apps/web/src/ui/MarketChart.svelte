<script lang="ts">
  // T-11-080f 카드 상세 시세 차트: 같은 포지션군 · OVR대 하루 평균 선, 최저~최고 띠, 기준가 점선, 이 선수 거래 점.
  // 영입 시트를 열 때만 부르고(1분 메모), 기간(1주 · 1달 · 시즌)을 바꾸면 그 기간만 새로 받는다. 점을 누르면 그날 값을 보여 준다.
  import { fetchCardTrades, fetchMarketChart, type MarketCard, type MarketChartPoint, type MarketChartRange } from '@offside/app-core/api/market';
  import { CHART_COPY, CHART_RANGES, chartModel, dayText, tradeText, type CardTrade } from '@offside/app-core/marketChart';
  import { ovrBand } from '@offside/contracts/market-value';
  import { POS_LABEL } from '@offside/game/pos-label';

  let { card }: { card: MarketCard } = $props();

  let range = $state<MarketChartRange>('week');
  let points = $state<MarketChartPoint[] | null>(null);
  let trades = $state<CardTrade[]>([]);
  let failed = $state(false);
  let pick = $state<string | null>(null);
  const band = $derived(ovrBand(card.peak));

  $effect(() => {
    const r = range;
    const group = { pos: card.pos, band };
    failed = false;
    pick = null;
    void fetchMarketChart(r, group).then((res) => {
      if (r !== range) return;
      failed = !res.ok;
      points = res.ok ? res.data.points : [];
    });
  });
  $effect(() => {
    void fetchCardTrades(card.careerId).then((res) => (trades = res.ok ? res.data.trades : []));
  });

  const model = $derived(points ? chartModel(points, trades, range) : null);
  const picked = $derived.by(() => {
    if (!model || !pick) return null;
    const [kind, i] = pick.split(':');
    const n = Number(i);
    return kind === 'd' ? (model.days[n] ? dayText(model.days[n].p) : null) : model.dots[n] ? tradeText(model.dots[n].t) : null;
  });
</script>

<section class="mc" aria-label={CHART_COPY.title} data-market-chart>
  <div class="mc-head">
    <div>
      <h3>{CHART_COPY.title}</h3>
      <small>{CHART_COPY.group(POS_LABEL[card.pos], band)}</small>
    </div>
    <div class="mc-ranges" role="group" aria-label="기간">
      {#each CHART_RANGES as [k, label] (k)}
        <button aria-pressed={range === k} data-chart-range={k} onclick={() => (range = k)}>{label}</button>
      {/each}
    </div>
  </div>
  {#if points === null}
    <p class="mc-empty">불러오는 중…</p>
  {:else if failed}
    <p class="mc-empty">{CHART_COPY.failed}</p>
  {:else if !model}
    <p class="mc-empty" data-chart-empty>{CHART_COPY.empty}</p>
  {:else}
    <p class="mc-pick" aria-live="polite">{picked ?? ' '}</p>
    <div class="mc-plot mc-{model.tone}">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {#if model.band}<path class="mc-band" d={model.band} />{/if}
        <line class="mc-base" x1="0" x2="100" y1={model.base} y2={model.base} />
        {#if model.line}<path class="mc-line" d={model.line} />{/if}
      </svg>
      <span class="mc-axis mc-top">{model.top}</span>
      <span class="mc-axis mc-bottom">{model.bottom}</span>
      <span class="mc-base-label" style:top="{model.base}%">기준가</span>
      {#each model.days as d, i (d.p.day)}
        <button class="mc-day" style:left="{d.x}%" style:top="{d.y}%" aria-label={dayText(d.p)} onclick={() => (pick = `d:${i}`)}></button>
      {/each}
      {#each model.dots as d, i (i)}
        <button class="mc-dot" style:left="{d.x}%" style:top="{d.y}%" aria-label={tradeText(d.t)} data-chart-trade onclick={() => (pick = `t:${i}`)}></button>
      {/each}
    </div>
    <div class="mc-foot">
      <span>{model.from}</span>
      <span class="mc-legend">
        {#if model.line}<i class="l-line"></i>{CHART_COPY.legendLine}{/if}
        <i class="l-base"></i>{CHART_COPY.legendBase}
        {#if model.dots.length}<i class="l-dot"></i>{CHART_COPY.legendDot}{/if}
      </span>
      <span>{model.to}</span>
    </div>
  {/if}
</section>

<style>
  .mc {
    --rise: var(--bad);
    --fall: var(--r2);
    border-top: 1px solid var(--line);
    padding: 14px 0 4px;
  }
  .mc-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
  }
  .mc-head h3 {
    margin: 0;
    font-size: 0.875rem;
  }
  .mc-head small {
    color: var(--muted);
    font-size: 0.75rem;
  }
  .mc-ranges {
    display: flex;
    gap: 2px;
    background: var(--surface-2);
    border-radius: 8px;
    padding: 2px;
  }
  .mc-ranges button {
    border: 0;
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 4px 9px;
    border-radius: 6px;
    min-height: 28px;
    cursor: pointer;
  }
  .mc-ranges button[aria-pressed='true'] {
    background: var(--surface);
    color: var(--ink);
    box-shadow: var(--shadow);
  }
  .mc-empty {
    color: var(--muted);
    font-size: 0.8125rem;
    text-align: center;
    padding: 28px 0;
    margin: 0;
  }
  .mc-pick {
    margin: 6px 0 2px;
    min-height: 1.2em;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--ink);
    white-space: pre;
  }
  .mc-plot {
    position: relative;
    height: 132px;
    margin: 0 34px 0 0;
    --tone: var(--muted);
  }
  .mc-up {
    --tone: var(--rise);
  }
  .mc-down {
    --tone: var(--fall);
  }
  .mc-plot svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .mc-band {
    fill: var(--tone);
    opacity: 0.12;
  }
  .mc-line {
    fill: none;
    stroke: var(--tone);
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .mc-base {
    stroke: var(--muted);
    stroke-width: 1;
    stroke-dasharray: 4 4;
    vector-effect: non-scaling-stroke;
  }
  .mc-axis,
  .mc-base-label {
    position: absolute;
    right: -34px;
    font-size: 0.625rem;
    color: var(--muted);
    transform: translateY(-50%);
  }
  .mc-top {
    top: 8%;
  }
  .mc-bottom {
    top: 92%;
  }
  .mc-day,
  .mc-dot {
    position: absolute;
    transform: translate(-50%, -50%);
    border: 0;
    padding: 0;
    cursor: pointer;
    background: transparent;
    width: 24px;
    height: 24px;
  }
  .mc-day::after,
  .mc-dot::after {
    content: '';
    position: absolute;
    inset: 50%;
    border-radius: 50%;
  }
  .mc-day::after {
    margin: -3px;
    background: var(--surface);
    border: 2px solid var(--tone);
    width: 2px;
    height: 2px;
  }
  .mc-dot::after {
    margin: -5px;
    width: 10px;
    height: 10px;
    background: var(--accent);
    border: 2px solid var(--surface);
    box-sizing: border-box;
  }
  .mc-foot {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin: 6px 34px 0 0;
    font-size: 0.6875rem;
    color: var(--muted);
  }
  .mc-legend {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
    justify-content: center;
  }
  .mc-legend i {
    display: inline-block;
    width: 12px;
    margin-left: 6px;
  }
  .l-line {
    height: 2px;
    background: var(--muted);
  }
  .l-base {
    border-top: 1px dashed var(--muted);
  }
  .l-dot {
    width: 8px !important;
    height: 8px;
    border-radius: 50%;
    background: var(--accent);
  }
</style>
