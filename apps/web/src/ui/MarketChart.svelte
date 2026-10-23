<script lang="ts">
  import Skeleton from './Skeleton.svelte';
  import { tn } from '@offside/game/i18n/names';
  // T-11-080f 카드 상세 시세 차트: 같은 포지션군 · OVR대 하루 평균 선, 최저~최고 띠, 기준가 점선, 이 선수 거래 점.
  // 영입 시트를 열 때만 부르고(1분 메모), 기간(1주 · 1달 · 시즌)을 바꾸면 그 기간만 새로 받는다. 점을 누르면 그날 값을 보여 준다.
  import { fetchCardTrades, fetchMarketChart, type MarketCard, type MarketChartPoint, type MarketChartRange } from '@offside/app-core/api/market';
  import { CHART_COPY, chartRanges, chartModel, dayText, tradeText, type CardTrade } from '@offside/app-core/marketChart';
  import { ovrBand } from '@offside/contracts/market-value';
  import { POS_LABEL } from '@offside/game/pos-label';
  import { marketChartText as L } from '@offside/app-core/i18n/ko/marketChart';

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
  // 한 번도 팔린 적 없는 선수(이적 0회)는 거래 기록을 묻지 않는다.
  $effect(() => {
    if (card.transfers > 0) void fetchCardTrades(card.careerId).then((res) => (trades = res.ok ? res.data.trades : []));
  });

  const model = $derived(points ? chartModel(points, trades, range) : null);
  // T-11-474 면 그라데이션 id(한 화면에 차트가 둘 이상 떠도 겹치지 않게).
  const gid = `mcg-${Math.random().toString(36).slice(2, 8)}`;
</script>

<section class="mc" aria-label={CHART_COPY.title} data-market-chart>
  <div class="mc-head">
    <div>
      <h3>{CHART_COPY.title}</h3>
      <small>{CHART_COPY.group(tn(POS_LABEL[card.pos]), band)}</small>
      {#if model?.last}
        <p class="mc-now mc-{model.tone}" data-chart-now>
          <b>{model.last.pct}</b>{#if model.change}<em>{model.change}</em>{/if}
        </p>
      {/if}
    </div>
    <div class="mc-ranges" role="group" aria-label={L.rangeGroup}>
      {#each chartRanges() as [k, label] (k)}
        <button aria-pressed={range === k} data-chart-range={k} onclick={() => (range = k)}>{label}</button>
      {/each}
    </div>
  </div>
  {#if points === null}
    <Skeleton height={132} />
  {:else if failed}
    <p class="mc-empty">{CHART_COPY.failed}</p>
  {:else if !model}
    <p class="mc-empty" data-chart-empty>{CHART_COPY.empty}</p>
  {:else}
    <p class="mc-pick" aria-live="polite">{pick ?? ' '}</p>
    <div class="mc-plot mc-{model.tone}">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stop-color="currentColor" stop-opacity="0.28" />
            <stop offset="1" stop-color="currentColor" stop-opacity="0" />
          </linearGradient>
        </defs>
        {#if model.band}<path class="mc-band" d={model.band} />{/if}
        {#if model.area}<path class="mc-area" d={model.area} fill="url(#{gid})" />{/if}
        <line class="mc-base" x1="0" x2="100" y1={model.base} y2={model.base} />
        {#key range}
          {#if model.line}<path class="mc-line" d={model.line} pathLength="1" />{/if}
        {/key}
      </svg>
      {#if model.last}<span class="mc-pulse" style:left="{model.last.x}%" style:top="{model.last.y}%" aria-hidden="true"></span>{/if}
      <span class="mc-axis mc-top">{model.top}</span>
      <span class="mc-axis mc-bottom">{model.bottom}</span>
      <span class="mc-base-label" style:top="{model.base}%">{L.baseLabel}</span>
      {#each model.days as d (d.p.day)}
        <button class="mc-day" style:left="{d.x}%" style:top="{d.y}%" aria-label={dayText(d.p)} onclick={() => (pick = dayText(d.p))}></button>
      {/each}
      {#each model.dots as d, i (i)}
        <button class="mc-dot" style:left="{d.x}%" style:top="{d.y}%" aria-label={tradeText(d.t)} data-chart-trade onclick={() => (pick = tradeText(d.t))}></button>
      {/each}
    </div>
    {#if model.bars.length}
      <div class="mc-vol" aria-label={CHART_COPY.volume}>
        {#each model.bars as b (b.p.day)}
          <i style:left="{b.x}%" style:height="{b.h}%" class:mc-vol-last={b === model.bars.at(-1)}></i>
        {/each}
      </div>
    {/if}
    <div class="mc-foot">
      <span>{model.from}</span>
      <span class="mc-legend">
        {#if model.line}<i class="l-line"></i>{CHART_COPY.legendLine}{/if}
        {#if model.bars.length}<i class="l-vol"></i>{CHART_COPY.volume}{/if}
        {#if model.dots.length}<i class="l-dot"></i>{CHART_COPY.legendDot}{/if}
      </span>
      <span>{model.to}</span>
    </div>
  {/if}
</section>

<style>
  .mc {
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
    font-size: var(--fs-body2);
  }
  .mc-head small {
    color: var(--muted);
    font-size: var(--fs-caption);
  }
  .mc-ranges {
    display: flex;
    gap: 2px;
    background: var(--surface-2);
    border-radius: var(--radius-sm);
    padding: 2px;
  }
  .mc-ranges button {
    border: 0;
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-size: var(--fs-caption);
    font-weight: 600;
    padding: 4px 9px;
    border-radius: var(--radius-xs);
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
    font-size: var(--fs-label);
    text-align: center;
    padding: 28px 0;
    margin: 0;
  }
  .mc-pick {
    margin: 6px 0 2px;
    min-height: 1.2em;
    font-size: var(--fs-caption);
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
    --tone: var(--up);
  }
  .mc-down {
    --tone: var(--down);
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
    opacity: 0.1;
  }
  .mc-plot {
    color: var(--tone);
  }
  .mc-now {
    display: flex;
    align-items: baseline;
    gap: 6px;
    margin: 4px 0 0;
  }
  .mc-now b {
    font-family: var(--display);
    font-size: var(--fs-title2);
    color: var(--ink);
  }
  .mc-now em {
    font-style: normal;
    font-size: var(--fs-caption);
    font-weight: 700;
    color: var(--muted);
  }
  .mc-now.mc-up em {
    color: var(--up);
  }
  .mc-now.mc-down em {
    color: var(--down);
  }
  /* T-11-474 선을 왼쪽에서 그려 나가고, 마지막 거래일 점이 맥박처럼 뛴다(움직임 줄이기면 멈춘다). */
  .mc-line {
    stroke-dasharray: 1;
    stroke-dashoffset: 0;
    animation: mc-draw 0.9s ease-out;
  }
  @keyframes mc-draw {
    from {
      stroke-dashoffset: 1;
    }
  }
  .mc-pulse {
    position: absolute;
    width: 9px;
    height: 9px;
    margin: -4.5px 0 0 -4.5px;
    border-radius: 50%;
    background: var(--tone);
    box-shadow: 0 0 0 2px var(--surface);
    pointer-events: none;
  }
  .mc-pulse::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: var(--tone);
    animation: mc-ping 1.8s ease-out infinite;
  }
  @keyframes mc-ping {
    from {
      transform: scale(1);
      opacity: 0.55;
    }
    to {
      transform: scale(3.2);
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .mc-line,
    .mc-pulse::after {
      animation: none;
    }
  }
  .mc-vol {
    position: relative;
    height: 22px;
    margin: 4px 34px 0 0;
    border-bottom: 1px solid var(--line);
  }
  .mc-vol i {
    position: absolute;
    bottom: 0;
    width: 4px;
    margin-left: -2px;
    border-radius: 2px 2px 0 0;
    background: var(--muted);
    opacity: 0.35;
  }
  .mc-vol i.mc-vol-last {
    background: var(--accent);
    opacity: 0.8;
  }
  .l-vol {
    height: 8px;
    width: 4px !important;
    background: var(--muted);
    opacity: 0.5;
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
    font-size: var(--fs-caption2);
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
    font-size: var(--fs-caption2);
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
  .l-dot {
    width: 8px !important;
    height: 8px;
    border-radius: 50%;
    background: var(--accent);
  }
</style>
