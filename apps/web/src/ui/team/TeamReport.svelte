<script lang="ts">
  // T-11-379 경기 리포트 — 기대 득점 · 진단 한 줄 · 줄 비교 세 줄. T-11-498 줄 비교를 접지 않고 가운데 선 기준 막대로 보여 주고,
  // 가장 밀린 줄에서 바로 편성(고칠 곳)으로 간다. 고칠 곳은 내 편성을 고칠 수 있을 때만.
  import type { TeamMatch } from '@offside/app-core/api/team';
  import { teamMatchReport } from '@offside/app-core/matchReport';
  import { matchReportText as L } from '@offside/app-core/i18n/ko/matchReport';
  import { signedNum } from '@offside/app-core/teamText';
  import type { ReportLine } from '@offside/contracts/owner-team';

  let { m, fix }: { m: TeamMatch; fix?: ((line: ReportLine) => { pos: string; go: () => void } | null) | undefined } = $props();
  const r = $derived(teamMatchReport(m));
  const target = $derived(r?.weak && fix ? fix(r.weak) : null);
  // 차이 30점이면 막대가 한쪽 끝까지 간다(줄 비교는 대개 ±30 안에 있다).
  const half = (edge: number) => `${Math.max(2, Math.min(50, (Math.abs(edge) / 30) * 50))}%`;
</script>

{#if r}
  <div class="tm-report stack" style="gap:10px" data-team-report>
    <div class="tm-report-head">
      <h2 class="tm-report-title">{L.nextTitle}</h2>
      <span class="tm-report-xg" data-report-xg>{r.xgText}</span>
    </div>
    <p class="fs-sm" style="margin:0" data-report-diagnosis>{r.diagnosis}</p>
    <ul class="tm-report-rows" data-report-rows>
      {#each r.rows as row (row.line)}
        <li class:weak={row.line === r.weak} class:up={row.edge >= 0} data-report-line={row.line} aria-label={L.lineAria({ line: row.label, mine: row.mine, opp: row.opp })}>
          <span class="tm-report-label fs-sm" aria-hidden="true">
            <span>{row.label}</span>
            <span><small class="muted">{row.mine} : {row.opp}</small> <b>{signedNum(Math.round(row.edge))}</b></span>
          </span>
          <span class="tm-report-axis" aria-hidden="true"><span style:width={half(row.edge)}></span></span>
        </li>
      {/each}
    </ul>
    <p class="muted fs-xs" style="margin:0">{L.axisNote} {L.wallNote}</p>
    <p class="muted fs-xs" style="margin:0">{L.xgHint}</p>
    {#if target}
      <button class="btn tm-report-fix" onclick={target.go} aria-label={L.fixAria({ pos: target.pos })} data-act="team-report-fix">{L.fix({ pos: target.pos })}</button>
    {/if}
  </div>
{/if}

<style>
  .tm-report {
    padding: 14px;
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
  .tm-report-title {
    margin: 0;
    font-size: var(--fs-body);
  }
  .tm-report-xg {
    font-family: var(--display);
    font-weight: 700;
    color: var(--muted);
  }
  .tm-report-rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .tm-report-rows li {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .tm-report-label {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }
  .tm-report-label b {
    font-family: var(--display);
    color: var(--good);
  }
  .tm-report-rows li:not(.up) .tm-report-label b {
    color: var(--bad);
  }
  .tm-report-rows li.weak .tm-report-label > span:first-child {
    color: var(--bad);
    font-weight: 700;
  }
  .tm-report-axis {
    position: relative;
    height: 8px;
    border-radius: 4px;
    background: var(--line);
  }
  .tm-report-axis::after {
    content: '';
    position: absolute;
    left: 50%;
    top: -3px;
    bottom: -3px;
    width: 2px;
    margin-left: -1px;
    background: var(--faint);
  }
  .tm-report-axis > span {
    position: absolute;
    top: 0;
    bottom: 0;
    border-radius: 4px;
  }
  .tm-report-rows li.up .tm-report-axis > span {
    left: 50%;
    background: var(--good);
  }
  .tm-report-rows li:not(.up) .tm-report-axis > span {
    right: 50%;
    background: var(--bad);
  }
  .tm-report-fix {
    border-color: var(--accent);
    color: var(--accent-text);
    background: transparent;
  }
</style>
