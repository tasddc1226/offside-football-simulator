<script lang="ts">
  // 날짜별 쌓은 막대(나눔이 하나면 그냥 막대). 색은 묶음 안 순서대로 고정 슬롯(--s1~), 마우스 · 포커스로 그날 값을 모두 보인다.
  import { fmt, type Series } from '../kpi.ts';

  let {
    title,
    days,
    series,
    unit = 'n',
    empty = '아직 들어온 값이 없어요.',
  }: {
    title: string;
    days: readonly string[];
    series: Series[];
    unit?: 'n' | 'krw';
    empty?: string;
  } = $props();

  // 실제 폭으로 그린다(viewBox로 줄이면 좁은 카드에서 글씨가 작아진다).
  let width = $state(640);
  const W = $derived(Math.max(240, width));
  const H = 180;
  const PAD = { l: 52, r: 8, t: 8, b: 22 };
  const GAP = 2;

  let hover = $state<number | null>(null);

  /** 모든 계열이 비어 있는 날 = 수집 안 된 날(0과 구별해 점선으로 그린다). */
  const missing = $derived(days.map((_, i) => series.every((s) => s.values[i] === null)));
  const totals = $derived(days.map((_, i) => series.reduce((s, x) => s + (x.values[i] ?? 0), 0)));
  const max = $derived(niceMax(Math.max(0, ...totals)));
  const bw = $derived((W - PAD.l - PAD.r) / Math.max(1, days.length));
  const barW = $derived(Math.max(2, Math.min(28, bw - 3)));
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / (max || 1));
  const x = (i: number) => PAD.l + bw * i + (bw - barW) / 2;

  function niceMax(v: number) {
    if (v <= 0) return 1;
    const p = 10 ** Math.floor(Math.log10(v));
    const n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  }
  /** 위쪽만 둥근 막대 조각(맨 위 조각만). */
  function seg(i: number, lo: number, hi: number, top: boolean) {
    const x0 = x(i);
    const y0 = y(hi);
    const y1 = y(lo) - (lo > 0 ? GAP : 0);
    const h = Math.max(0, y1 - y0);
    if (h <= 0) return '';
    const r = top ? Math.min(4, barW / 2, h) : 0;
    return `M${x0},${y1}V${y0 + r}Q${x0},${y0} ${x0 + r},${y0}H${x0 + barW - r}Q${x0 + barW},${y0} ${x0 + barW},${y0 + r}V${y1}Z`;
  }
  const stacks = $derived(
    days.map((_, i) => {
      let acc = 0;
      const parts = series.map((s, k) => {
        const v = s.values[i] ?? 0;
        const p = { k, lo: acc, hi: acc + v };
        acc += v;
        return p;
      });
      const topK = parts.findLast((p) => p.hi > p.lo)?.k;
      return parts.map((p) => ({ ...p, top: p.k === topK }));
    }),
  );
  const label = (d: string) => d.slice(5).replace('-', '/');
  const tickEvery = $derived(Math.ceil(days.length / 8));
</script>

<figure class="chart">
  <figcaption>
    <h3>{title}</h3>
    {#if series.length > 1}
      <ul class="legend">
        {#each series as s, k (s.key)}
          <li><span class="key" style:background={`var(--s${k + 1})`}></span>{s.label}</li>
        {/each}
      </ul>
    {/if}
  </figcaption>
  {#if !series.length}
    <p class="empty">{empty}</p>
  {:else}
    <div class="plot" bind:clientWidth={width}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        {#each [0, 0.5, 1] as f (f)}
          <line class="grid" x1={PAD.l} x2={W - PAD.r} y1={y(max * f)} y2={y(max * f)} />
          <text class="tick" x={PAD.l - 6} y={y(max * f) + 4} text-anchor="end">{fmt(max * f, unit)}</text>
        {/each}
        {#each stacks as parts, i (days[i])}
          {#each parts as p (p.k)}
            <path d={seg(i, p.lo, p.hi, p.top)} fill={`var(--s${p.k + 1})`} opacity={hover === null || hover === i ? 1 : 0.45} />
          {/each}
          {#if missing[i]}
            <line class="missing" x1={x(i)} x2={x(i) + barW} y1={y(0) - 1} y2={y(0) - 1} />
          {/if}
          {#if i % tickEvery === (days.length - 1) % tickEvery}
            <text class="tick" x={x(i) + barW / 2} y={H - 6} text-anchor="middle">{label(days[i]!)}</text>
          {/if}
          <rect
            class="hit"
            x={PAD.l + bw * i}
            y={PAD.t}
            width={bw}
            height={H - PAD.t - PAD.b}
            tabindex="0"
            role="button"
            aria-label={`${days[i]} ${fmt(totals[i]!, unit)}`}
            onpointerenter={() => (hover = i)}
            onpointerleave={() => (hover = null)}
            onfocus={() => (hover = i)}
            onblur={() => (hover = null)}
          />
        {/each}
      </svg>
      {#if hover !== null}
        <div class="tip" style:left={`${((x(hover) + barW / 2) / W) * 100}%`}>
          <strong>{days[hover]}</strong>
          {#if missing[hover]}<div>수집 안 됨</div>{/if}
          {#each series as s, k (s.key)}
            <div><span class="line" style:background={`var(--s${k + 1})`}></span><b>{fmt(s.values[hover] ?? null, unit)}</b> {s.label}</div>
          {/each}
          {#if series.length > 1}<div class="sum"><b>{fmt(totals[hover]!, unit)}</b> 합계</div>{/if}
        </div>
      {/if}
    </div>
  {/if}
</figure>

<style>
  .chart { margin: 0; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; min-width: 0; }
  figcaption { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 6px 12px; margin-bottom: 8px; }
  h3 { margin: 0; font-size: 14px; font-weight: 600; color: var(--text); }
  .legend { display: flex; flex-wrap: wrap; gap: 4px 12px; list-style: none; margin: 0; padding: 0; font-size: 12px; color: var(--text-2); }
  .legend li { display: flex; align-items: center; gap: 6px; }
  .key { width: 10px; height: 10px; border-radius: 3px; }
  .plot { position: relative; }
  svg { width: 100%; height: auto; display: block; overflow: visible; }
  .grid { stroke: var(--grid); stroke-width: 1; }
  .missing { stroke: var(--muted); stroke-width: 2; stroke-dasharray: 2 2; }
  .tick { fill: var(--muted); font-size: 11px; font-variant-numeric: tabular-nums; }
  .hit { fill: transparent; cursor: default; outline: none; }
  .hit:focus-visible { stroke: var(--text-2); stroke-width: 1; }
  .tip { position: absolute; top: 0; transform: translateX(-50%); background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; font-size: 12px; color: var(--text-2); pointer-events: none; white-space: nowrap; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12); z-index: 2; }
  .tip strong { display: block; color: var(--text); margin-bottom: 4px; }
  .tip b { color: var(--text); font-variant-numeric: tabular-nums; }
  .tip .line { display: inline-block; width: 12px; height: 2px; vertical-align: middle; margin-right: 6px; }
  .tip .sum { margin-top: 4px; border-top: 1px solid var(--grid); padding-top: 4px; }
  .empty { margin: 24px 0; color: var(--muted); font-size: 13px; text-align: center; }
</style>
