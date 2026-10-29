<script lang="ts">
  // T-11-577 광고 제거 가격 판단(T-11-574): 인상 전후 완료된 날의 하루 판매 건수와 멤버십 구독 중 인원.
  // 판단 기준(결정 로그 2026-10-29): 11-12에 하루 15건 미만이고 멤버십이 함께 늘지 않으면 5,500원, 기준선의 70% 이상이면 7,700~8,800원 시험.
  import type { AdminRevenue, KpiReport } from '@offside/contracts';
  import { REMOVE_ADS_PRICE_CHANGED_AT } from '@offside/contracts/admin-items';
  import { fmt, valueOn, indexRows } from '../kpi.ts';
  import StackedBars from './StackedBars.svelte';

  let { rev, kpi }: { rev: AdminRevenue; kpi: KpiReport | null } = $props();

  const BASELINE_PER_DAY = 33;
  const DECIDE_ON = '2026-11-12';
  // 바꾼 날(KST)은 두 가격이 섞여 비교에서 뺀다.
  const changeDay = new Date(Date.parse(REMOVE_ADS_PRICE_CHANGED_AT) + 9 * 3_600_000).toISOString().slice(0, 10);

  // 마지막 날은 오늘(진행 중)이라 뺀다.
  const done = $derived(rev.daily.slice(0, -1));
  const before = $derived(done.filter((d) => d.day < changeDay));
  const after = $derived(done.filter((d) => d.day > changeDay));
  const avg = (xs: { adCount?: number | undefined }[]) =>
    xs.length ? xs.reduce((s, x) => s + (x.adCount ?? 0), 0) / xs.length : null;
  const beforeAvg = $derived(avg(before));
  const afterAvg = $derived(avg(after));
  const share = $derived(afterAvg === null ? null : afterAvg / BASELINE_PER_DAY);

  const members = $derived.by(() => {
    if (!kpi) return { now: null, start: null };
    const idx = indexRows(kpi);
    const at = (d: string | undefined) => (d ? valueOn(idx, d, 'members_active') : null);
    return { now: at(kpi.days.at(-1)), start: at(kpi.days.find((d) => d >= changeDay)) };
  });

  const verdict = $derived(
    afterAvg === null
      ? { cls: '', text: '인상 뒤 완료된 날이 아직 없어요.' }
      : afterAvg < 15
        ? { cls: 'bad', text: '하루 15건 미만: 멤버십이 함께 늘지 않으면 5,500원으로 내리는 쪽' }
        : share !== null && share >= 0.7
          ? { cls: 'good', text: '기준선 70% 이상: 7,700~8,800원 시험 후보' }
          : { cls: 'warn', text: '중간 구간: 6,600원 유지하며 멤버십 추이를 더 봐요' },
  );
</script>

<section class="panel">
  <header>
    <h2>광고 제거 가격 판단</h2>
    <span class="hint">{changeDay} 3,300 → 6,600원 · {DECIDE_ON} 결정</span>
  </header>
  <div class="grid">
    <div>
      <p class="k">인상 전 하루 평균</p>
      <p class="v">{beforeAvg === null ? '—' : beforeAvg.toFixed(1)}건</p>
      <p class="s">이 기간 {before.length}일 · 이전 기준선 {BASELINE_PER_DAY}건</p>
    </div>
    <div>
      <p class="k">인상 후 하루 평균</p>
      <p class="v">{afterAvg === null ? '—' : afterAvg.toFixed(1)}건</p>
      <p class="s">완료된 {after.length}일{share === null ? '' : ` · 기준선의 ${Math.round(share * 100)}%`}</p>
    </div>
    <div>
      <p class="k">멤버십 구독 중</p>
      <p class="v">{members.now === null ? '—' : `${fmt(members.now)}명`}</p>
      <p class="s">{members.start === null ? '일일 수집 전' : `인상 다음 날 ${fmt(members.start)}명`}</p>
    </div>
  </div>
  <p class="verdict"><span class={`chip ${verdict.cls}`}>{verdict.text}</span></p>
  <StackedBars
    title="하루 광고 제거 판매 건수 (환불 전)"
    days={rev.daily.map((d) => d.day)}
    series={[
      { key: 'old', label: '3,300원', values: rev.daily.map((d) => (d.day < changeDay ? (d.adCount ?? 0) : null)) },
      { key: 'new', label: '6,600원', values: rev.daily.map((d) => (d.day >= changeDay ? (d.adCount ?? 0) : null)) },
    ]}
  />
  <p class="note">
    전후 날짜 수와 요일 구성이 다르면 평균 비교가 흔들려요. 인과는 이것만으로 확정할 수 없어요. 오늘은 진행 중이라
    평균에서 빼요.
  </p>
</section>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 12px;
    margin-bottom: 12px;
  }
  .k {
    margin: 0;
    font-size: 12px;
    color: var(--text-2);
  }
  .v {
    margin: 4px 0 2px;
    font-size: 22px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .s {
    margin: 0;
    font-size: 12px;
    color: var(--muted);
  }
  .verdict {
    margin: 0 0 12px;
  }
  section :global(.chart) {
    border: 0;
    padding: 0;
    margin-bottom: 8px;
  }
</style>
