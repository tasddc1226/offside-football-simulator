<script lang="ts">
  // 시즌별 몸값 꺾은선 그래프(T-10-106): 커리어 탭과 은퇴 크레딧이 같이 쓴다.
  // 화면에 들어오면 선이 왼쪽부터 그려지고 점이 차례로 올라온다(감속 모션이면 처음부터 다 보인다).
  // 시즌마다 세로 한 칸이 버튼이라, 칸을 누르면 그 시즌 값을 위에 보여 준다.
  import type { CareerRecord } from '@offside/game/types';
  import { fmtValue, seasonLabelOf } from '@offside/app-core/format';
  import { peakValue } from '@offside/contracts/market-value';
  import { valuePoints } from '@offside/app-core/legendReport';
  import { motionOK } from './motion.js';
  import { marketValueChartText as L } from '@offside/app-core/i18n/ko/marketValueChart';

  let { rows }: { rows: CareerRecord[] } = $props();

  const peakV = $derived(peakValue(rows));
  const pts = $derived(valuePoints(rows, peakV?.value ?? 0));
  const line = $derived(pts.map((p, i) => `${i ? 'L' : 'M'}${p.x * 100},${p.y}`).join(''));
  let pick = $state<number | null>(null);
  const picked = $derived(pick == null ? null : pts[pick]);

  let go = $state(!motionOK);
  function inview(el: HTMLElement) {
    if (go) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        go = true;
        io.disconnect();
      },
      { rootMargin: '0px 0px -15% 0px' },
    );
    io.observe(el);
    return { destroy: () => io.disconnect() };
  }
</script>

{#if peakV}
  <div class="value-chart" class:go data-value-chart use:inview>
    <div class="value-chart-head fs-xs" data-value-pick>
      {#if picked}{picked.r.mil ? picked.r.year : seasonLabelOf(picked.r)} ({picked.r.age}) · {picked.r.club} · <b>{fmtValue(picked.v)}</b>{:else}<span class="muted">{L.hint}</span>{/if}
    </div>
    <div class="value-plot" role="group" aria-label={L.label} style="--n:{pts.length}">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path class="value-area" d="{line}L{pts[pts.length - 1]!.x * 100},100L{pts[0]!.x * 100},100Z" />
        <path class="value-line" d={line} />
      </svg>
      {#each pts as p, i (i)}
        {@const peak = p.r === peakV.row}
        <button type="button" class="value-dot" class:peak class:on={i === pick} style="--x:{p.x};--y:{p.y}%" aria-label={L.dotLabel({ year: p.r.year, club: p.r.club, value: fmtValue(p.v) })} aria-pressed={i === pick} onclick={() => (pick = pick === i ? null : i)}></button>
        {#if peak}<span class="value-peak-tag" style="--x:{p.x};--y:{p.y}%" aria-hidden="true">{fmtValue(p.v)}</span>{/if}
      {/each}
    </div>
    <div class="value-chart-axis muted fs-xs"><span>{rows[0]!.year}</span><span>{rows[rows.length - 1]!.year}</span></div>
  </div>
{/if}
