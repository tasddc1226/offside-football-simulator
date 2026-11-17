<script lang="ts">
  // T-11-739 아이템: 남은 장수 · 가진 사람 · 하루 사용 · 들어온 양(산 것 / 받은 것). 모두 일일 수집(kpi_daily)만 읽는다.
  import type { KpiReport } from '@offside/contracts';
  import { fmt, KPI_EMPTY, nonEmpty } from '../kpi.ts';
  import { byDim, dimTotals, lastDims, lastValue, periodTotal, trendOf, viewOf } from '../kpi-page.ts';
  import { avgUse, inflowSplit, itemName, ITEMS, supplyDays } from '../kpi-items.ts';
  import { fundKindName } from '../kpi-insights.ts';
  import { loader } from '../load.svelte.ts';
  import HBars from '../ui/HBars.svelte';
  import Load from '../ui/Load.svelte';
  import Stat from '../ui/Stat.svelte';
  import StackedBars from '../ui/StackedBars.svelte';

  let { days, tick }: { days: number; tick: number } = $props();
  const kpi = loader<KpiReport>(() => `/v1/admin/kpi?days=${days}`, () => tick);
  const SNAP_EMPTY = '남은 장수는 다음 일일 수집(04:00)부터 하루 한 번 쌓여요.';
  const FUND_EMPTY = '자금 흐름은 이번 배포 뒤 다음 일일 수집(04:00)부터 보여요.';
  const USE_EMPTY = '하루 사용은 이번 배포 뒤 쓴 장수부터 세요.';
  /** 아이템 이름표를 붙이고 위 카드와 같은 순서로. */
  const named = (s: ReturnType<typeof byDim>) =>
    s
      .map((x) => ({ ...x, label: itemName(x.key) }))
      .sort((a, b) => order(a.key) - order(b.key));
  const order = (k: string) => {
    const i = (ITEMS as readonly string[]).indexOf(k);
    return i < 0 ? ITEMS.length : i;
  };
</script>

<div class="page">
  <p class="note">
    남은 장수 · 가진 사람은 매일 04:00(KST) 수집 때의 상태예요. 하루 사용은 아이템을 쓸 때 서버가 센 수이고, 들어온 양은
    남은 장수 변화에 그날 사용을 더해 계산해요. 산 것은 아이템 팩 구매(환불 · 테스트 제외), 받은 것은 그 밖의 보상 · 선물 ·
    상점 구매예요. 운영자 · QA 계정도 들어 있어요.
  </p>
  <Load r={kpi.r} height={128}>
    {#snippet children(rep)}
      {@const v = viewOf(rep)}
      <div class="stats">
        {#each ITEMS as item (item)}
          {@const held = lastValue(v, 'items_held', [item])}
          {@const holders = lastValue(v, 'items_holders', [item])}
          {@const avg = avgUse(v, item)}
          {@const left = supplyDays(held?.value ?? null, avg)}
          <Stat
            label={`${itemName(item)} 남은 장수`}
            value={held?.value ?? null}
            sub={held
              ? `가진 사람 ${fmt(holders?.value ?? null)}명 · 하루 ${fmt(avg === null ? null : Math.round(avg))}장 사용${left === null ? '' : ` · ${Math.round(left)}일치`}`
              : SNAP_EMPTY}
            trend={trendOf(v, 'items_held', [item])}
          />
        {/each}
      </div>

      <div class="cols">
        <StackedBars title={`하루 사용 (${days}일)`} days={v.days} series={named(byDim(v, 'items_used'))} empty={USE_EMPTY} />
        <StackedBars title={`산 장수 · 아이템 팩 (${days}일)`} days={v.days} series={named(byDim(v, 'items_bought'))} empty={KPI_EMPTY} />
        <StackedBars title={`가진 사람 (${days}일)`} days={v.days} series={named(byDim(v, 'items_holders'))} empty={SNAP_EMPTY} />
      </div>

      <h2 class="section-title">들어온 양 (산 것 · 받은 것)</h2>
      <div class="cols">
        {#each ITEMS as item (item)}
          {@const split = inflowSplit(v, item)}
          <StackedBars
            title={itemName(item)}
            days={v.days}
            series={nonEmpty([
              { key: 'bought', label: '산 것', values: split.bought },
              { key: 'free', label: '받은 것', values: split.free },
            ])}
            empty="남은 장수가 이틀 이상 쌓이면 보여요."
          />
        {/each}
      </div>

      {@const total = lastDims(v, 'items_used_total')}
      <section class="panel">
        <header>
          <h2>누적 사용 (서버 기록)</h2>
          <span class="hint">{total.day ? `${total.day} 기준 · 강화권은 누적 기록이 없어 하루 사용부터 세요` : ''}</span>
        </header>
        {#if total.day}
          <HBars items={total.items.map((x) => ({ key: x.dim, label: itemName(x.dim), value: x.value }))} />
        {:else}
          <p class="note">{SNAP_EMPTY}</p>
        {/if}
      </section>

      <h2 class="section-title">구단 자금</h2>
      {@const funds = lastValue(v, 'funds_total')}
      {@const holders = lastValue(v, 'funds_holders')}
      {@const gain = periodTotal(v, 'fund_in')}
      {@const spend = periodTotal(v, 'fund_out')}
      <div class="stats">
        <Stat label="구단 자금 총량" value={funds?.value ?? null} trend={trendOf(v, 'funds_total')} sub={funds ? `${funds.day} 기준 · 자금 있는 구단주 ${fmt(holders?.value ?? null)}명` : SNAP_EMPTY} />
        <Stat label={`${days}일 원장 들어온 돈`} value={gain} trend={trendOf(v, 'fund_in')} />
        <Stat label={`${days}일 원장 나간 돈`} value={spend} trend={trendOf(v, 'fund_out')} sub={gain !== null || spend !== null ? `순흐름 ${fmt((gain ?? 0) - (spend ?? 0))}` : ''} />
      </div>
      <div class="cols">
        <StackedBars title="들어온 돈 (종류별)" days={v.days} series={byDim(v, 'fund_in').map((s) => ({ ...s, label: fundKindName(s.key) }))} empty={FUND_EMPTY} />
        <StackedBars title="나간 돈 (종류별)" days={v.days} series={byDim(v, 'fund_out').map((s) => ({ ...s, label: fundKindName(s.key) }))} empty={FUND_EMPTY} />
        <section class="panel">
          <header><h2>종류별 합</h2><span class="hint">{days}일 · 나간 돈 기준</span></header>
          {#if dimTotals(v, 'fund_out').length || dimTotals(v, 'fund_in').length}
            <HBars
              items={[...new Set([...dimTotals(v, 'fund_out'), ...dimTotals(v, 'fund_in')].map((x) => x.dim))].map((k) => {
                const out = periodTotal(v, 'fund_out', [k]) ?? 0;
                const got = periodTotal(v, 'fund_in', [k]) ?? 0;
                return { key: k, label: fundKindName(k), value: out, note: got ? `들어옴 ${fmt(got)}` : undefined };
              }).sort((a, b) => b.value - a.value)}
            />
          {:else}
            <p class="note">{FUND_EMPTY}</p>
          {/if}
        </section>
      </div>
      <p class="note">
        원장은 아이템 상점 · 카드 강화 · 이적시장 · 방출처럼 원장에 남는 흐름만 세요. 시즌 · 순위 보상처럼 원장에 남지 않는 지급은 총량 변화로만 보여요.
      </p>
    {/snippet}
  </Load>
</div>
