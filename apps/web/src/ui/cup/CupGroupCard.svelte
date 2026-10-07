<script lang="ts">
  // T-11-145 조 하나의 순위표와 경기 — 조 1·2위(토너먼트 진출권)를 초록으로 표시한다. 내 조는 펼쳐서 보여 준다.
  import type { CupMatch, CupResponse, CupTeam } from '@offside/app-core/api/cup';
  import { cupText as L } from '@offside/app-core/i18n/ko/cup';
  import CupMatchRow from './CupMatchRow.svelte';
  import { groupMatches } from './cupView.js';

  let { group, teams, matches, mineId, open = false, onopen }: {
    group: CupResponse['groups'][number];
    teams: ReadonlyMap<string, CupTeam>;
    matches: readonly CupMatch[];
    mineId: string | null;
    open?: boolean;
    onopen: (m: CupMatch) => void;
  } = $props();

  const rows = $derived([...group.standings].sort((a, b) => a.rank - b.rank));
  const list = $derived(groupMatches(matches, group.no));
  const mineHere = $derived(!!mineId && group.standings.some((s) => s.teamId === mineId));
  const gd = (gf: number, ga: number) => (gf - ga > 0 ? `+${gf - ga}` : String(gf - ga));
</script>

<details class="cg card" {open} data-cup-group={group.no}>
  <summary>
    <b>{L.groupName({ no: group.no })}</b>
    {#if mineHere}<span class="pill good">{L.myGroup}</span>{/if}
    <span class="muted fs-sm cg-n">{L.teamsCount({ n: rows.length })}</span>
  </summary>
  <div class="cg-scroll">
    <table class="cg-table">
      <thead>
        <tr>
          <th class="t">{L.thTeam}</th>
          <th>{L.thP}</th><th>{L.thW}</th><th>{L.thD}</th><th>{L.thL}</th><th>{L.thGd}</th><th>{L.thPts}</th>
        </tr>
      </thead>
      <tbody>
        {#each rows as s (s.teamId)}
          <tr class:adv={s.rank <= 2} class:mine={s.teamId === mineId} data-cup-rank={s.rank}>
            <td class="t"><span class="rk">{s.rank}</span><span class="nm">{teams.get(s.teamId)?.name ?? L.tbd}</span></td>
            <td>{s.p}</td><td>{s.w}</td><td>{s.d}</td><td>{s.l}</td><td>{gd(s.gf, s.ga)}</td><td><b>{s.pts}</b></td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  {#if list.length}
    <div class="cg-matches">
      {#each list as m (m.id)}<CupMatchRow {m} {teams} {mineId} {onopen} />{/each}
    </div>
  {/if}
</details>

<style>
  .cg {
    padding: 0;
    overflow: hidden;
  }
  .cg summary {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 16px;
    min-height: 44px;
    cursor: pointer;
    list-style: none;
  }
  .cg summary::-webkit-details-marker {
    display: none;
  }
  .cg-n {
    margin-left: auto;
  }
  .cg[open] summary {
    border-bottom: 1px solid var(--line);
  }
  .cg-scroll {
    overflow-x: auto;
  }
  .cg-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;
    font-variant-numeric: tabular-nums;
  }
  .cg-table th,
  .cg-table td {
    padding: 8px 6px;
    text-align: center;
    white-space: nowrap;
  }
  .cg-table th {
    font-weight: 600;
    color: var(--muted);
    font-size: 0.75rem;
  }
  .cg-table .t {
    text-align: left;
    padding-left: 14px;
    white-space: normal;
    width: 100%;
  }
  .t .rk {
    display: inline-block;
    width: 1.4em;
    color: var(--muted);
  }
  .t .nm {
    overflow-wrap: anywhere;
  }
  .cg-table tbody tr {
    border-top: 1px solid var(--line);
  }
  .cg-table tr.adv {
    background: color-mix(in srgb, var(--good) 12%, transparent);
    box-shadow: inset 3px 0 0 var(--good);
  }
  .cg-table tr.mine .nm {
    font-weight: 700;
    color: var(--accent-text);
  }
  .cg-matches {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px;
    border-top: 1px solid var(--line);
  }
</style>
