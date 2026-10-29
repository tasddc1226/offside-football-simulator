<script lang="ts">
  // T-11-577 데이터: 원천별 마지막 수집 · 일일 지표 원본 표 · CSV.
  import type { KpiReport } from '@offside/contracts';
  import { KPI_SOURCES } from '@offside/contracts/kpi-rules';
  import { fmt, kstTime, sourceLag, tableOf, toCsv } from '../kpi.ts';
  import { loader } from '../load.svelte.ts';
  import Load from '../ui/Load.svelte';

  let { days, tick }: { days: number; tick: number } = $props();
  const kpi = loader<KpiReport>(() => `/v1/admin/kpi?days=${days}`, () => tick);

  const SOURCE: Record<string, { label: string; when: string }> = {
    d1: { label: '운영 DB', when: '매일 04:00 서버 일일 작업' },
    ga4: { label: 'GA4', when: '매일 08:50 에이전트' },
    meta: { label: 'Meta 광고', when: '매일 08:50 에이전트' },
    admob: { label: 'AdMob', when: '연결 전' },
    store: { label: '스토어', when: '연결 전' },
  };
  /** 어제 날짜 행이 있는지만 본다(그날 지표가 모두 들어왔는지는 모른다). */
  function state(lastDay: string | undefined, yesterday: string | undefined) {
    const lag = sourceLag(lastDay, yesterday);
    if (lag === null) return { cls: '', text: '없음' };
    return lag <= 0
      ? { cls: 'good', text: '최근 행 있음' }
      : { cls: lag <= 1 ? 'warn' : 'bad', text: `${lag}일 밀림` };
  }
  function download(r: KpiReport) {
    const url = URL.createObjectURL(new Blob([toCsv(r)], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `offside-kpi-${r.days.at(-1)}-${days}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<div class="page">
  <Load r={kpi.r} height={400}>
    {#snippet children(r)}
      {@const t = tableOf(r)}
      <section class="panel">
        <header><h2>수집 원천</h2><span class="hint">어제({r.days.at(-1)}) 행이 있는지만 봐요. 지표별 누락은 아래 표에서 확인해요.</span></header>
        <div class="tbl-wrap">
          <table class="tbl">
            <thead><tr><th>원천</th><th>수집 시각</th><th>마지막 날</th><th>마지막 수집 (KST)</th><th>상태</th></tr></thead>
            <tbody>
              {#each KPI_SOURCES as id (id)}
                {@const s = r.sources.find((x) => x.source === id)}
                {@const st = state(s?.lastDay, r.days.at(-1))}
                <tr>
                  <td>{SOURCE[id]?.label ?? id}</td>
                  <td>{SOURCE[id]?.when ?? ''}</td>
                  <td>{s?.lastDay ?? '—'}</td>
                  <td>{s ? kstTime(s.updatedAt) : '—'}</td>
                  <td><span class={`chip ${st.cls}`}>{st.text}</span></td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel">
        <header>
          <h2>일일 지표 원본 ({r.days[0]} ~ {r.days.at(-1)})</h2>
          <button class="btn" disabled={!r.rows.length} onclick={() => download(r)}>CSV 받기</button>
        </header>
        {#if r.rows.length}
          <div class="tbl-wrap raw">
            <table class="tbl">
              <thead><tr><th>날짜</th>{#each t.cols as c (c)}<th class="num">{c.replace('|', ' · ')}</th>{/each}</tr></thead>
              <tbody>
                {#each t.rows.toReversed() as row (row.day)}
                  <tr><td>{row.day}</td>{#each row.cells as v, i (t.cols[i])}<td class="num">{fmt(v)}</td>{/each}</tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <p class="note">아직 수집된 지표가 없어요. 매일 04:00(KST) 일일 작업이 전날까지 채워요.</p>
        {/if}
      </section>
    {/snippet}
  </Load>
</div>

<style>
  .raw {
    max-height: 60vh;
  }
  .raw thead th {
    position: sticky;
    top: 0;
    background: var(--surface);
  }
  .btn {
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--text);
    border-radius: 8px;
    padding: 6px 12px;
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }
  .btn:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
