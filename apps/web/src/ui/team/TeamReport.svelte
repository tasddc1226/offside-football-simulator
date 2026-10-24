<script lang="ts">
  // T-11-379 경기 리포트 — 기대 득점 · 진단 한 줄은 바로, 줄 비교 세 줄은 접어 둔다. 고칠 곳은 내 편성을 고칠 수 있을 때만.
  import type { TeamMatch } from '@offside/app-core/api/team';
  import { teamMatchReport } from '@offside/app-core/matchReport';
  import { matchReportText as L } from '@offside/app-core/i18n/ko/matchReport';
  import type { ReportLine } from '@offside/contracts/owner-team';

  let { m, fix }: { m: TeamMatch; fix?: ((line: ReportLine) => { pos: string; go: () => void } | null) | undefined } = $props();
  const r = $derived(teamMatchReport(m));
  const target = $derived(r?.weak && fix ? fix(r.weak) : null);
  let open = $state(false);
  // 줄 힘은 대개 40~100이라 그 구간을 막대 전체로 늘려 차이가 보이게 한다.
  const width = (x: number) => `${Math.max(4, Math.min(100, ((x - 40) / 60) * 100))}%`;
</script>

{#if r}
  <div class="tm-report stack" style="gap:8px" data-team-report>
    <div class="tm-report-head">
      <b>{L.title}</b>
      <span class="tm-report-xg" data-report-xg>{r.xgText}</span>
    </div>
    <p class="fs-sm" style="margin:0" data-report-diagnosis>{r.diagnosis}</p>
    <p class="muted fs-xs" style="margin:0">{L.xgHint}</p>
    <button class="btn btn-sm tm-report-toggle" aria-expanded={open} onclick={() => (open = !open)} data-act="team-report-compare">{open ? L.compareClose : L.compareOpen}</button>
    {#if open}
      <ul class="tm-report-rows" data-report-rows>
        {#each r.rows as row (row.line)}
          <li class:weak={row.line === r.weak} data-report-line={row.line} aria-label={L.lineAria({ line: row.label, mine: row.mine, opp: row.opp })}>
            <span class="fs-sm">{row.label}</span>
            <span class="tm-report-bars" aria-hidden="true">
              <b>{row.mine}</b>
              <span class="bar"><span class="me" style:width={width(row.mine)}></span></span>
              <span class="bar"><span class="op" style:width={width(row.opp)}></span></span>
              <b>{row.opp}</b>
            </span>
          </li>
        {/each}
      </ul>
      <p class="muted fs-xs" style="margin:0">{L.wallNote}</p>
    {/if}
    {#if target}
      <button class="btn btn-sm" onclick={target.go} aria-label={L.fixAria({ pos: target.pos })} data-act="team-report-fix">{L.fix({ pos: target.pos })}</button>
    {/if}
  </div>
{/if}

<style>
  .tm-report {
    padding: 12px;
    border-radius: var(--radius-md);
    background: var(--surface-2);
  }
  .tm-report-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    flex-wrap: wrap;
  }
  .tm-report-xg {
    font-family: var(--display);
    font-weight: 700;
  }
  .tm-report-toggle {
    justify-self: start;
    align-self: flex-start;
  }
  .tm-report-rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .tm-report-rows li {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .tm-report-rows li.weak > span:first-child {
    color: var(--bad, var(--accent-text));
    font-weight: 600;
  }
  .tm-report-bars {
    display: grid;
    grid-template-columns: 2em 1fr 1fr 2em;
    align-items: center;
    gap: 6px;
  }
  .tm-report-bars b:last-child {
    text-align: right;
  }
  .bar {
    height: 6px;
    border-radius: 3px;
    background: var(--line);
    overflow: hidden;
    display: flex;
  }
  .bar:nth-of-type(1) {
    justify-content: flex-end;
  }
  .bar .me {
    background: var(--accent);
  }
  .bar .op {
    background: var(--muted);
  }
</style>
