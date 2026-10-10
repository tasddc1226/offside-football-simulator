<script lang="ts">
  // T-11-145 조 하나의 순위표와 경기 — 조 1·2위(토너먼트 진출권)를 초록으로 표시한다. 내 조는 펼쳐서 보여 준다.
  import type { CupMatch, CupResponse, CupTeam } from '@offside/app-core/api/cup';
  import { cupText as L } from '@offside/app-core/i18n/ko/cup';
  import type { CupPredictionContext } from '@offside/app-core/cupPredictions';
  import CupMatchRow from './CupMatchRow.svelte';
  import TeamLogo from '../team/TeamLogo.svelte';
  import { groupMatches } from './cupView.js';

  let { group, teams, matches, mineId, open = false, onopen, prediction }: {
    group: CupResponse['groups'][number];
    teams: ReadonlyMap<string, CupTeam>;
    matches: readonly CupMatch[];
    mineId: string | null;
    open?: boolean;
    onopen: (m: CupMatch) => void;
    prediction: CupPredictionContext;
  } = $props();

  const rows = $derived([...group.standings].sort((a, b) => a.rank - b.rank));
  const list = $derived(groupMatches(matches, group.no));
  const mineHere = $derived(!!mineId && group.standings.some((s) => s.teamId === mineId));
  const gd = (gf: number, ga: number) => (gf - ga > 0 ? `+${gf - ga}` : String(gf - ga));
</script>

<details class="cg" {open} data-cup-group={group.no}>
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
          {@const team=teams.get(s.teamId)}
          <tr class:adv={s.rank <= 2} class:mine={s.teamId === mineId} data-cup-rank={s.rank}>
            <td class="t"><div class="cg-identity"><span class="rk">{s.rank}</span><button class="nm" onclick={() => prediction.team(s.teamId)} aria-label={`${team?.name ?? L.tbd} · ${team?.owner ?? ''} · ${L.lineupOpen}`}><TeamLogo logo={team?.logo} name={team?.name ?? L.tbd} size={24} decorative /><span class="cg-who"><b>{team?.name ?? L.tbd} ↗</b><small class="muted">{L.teamOwnerLabel} {team?.owner ?? L.tbd}</small></span></button></div></td>
            <td>{s.p}</td><td>{s.w}</td><td>{s.d}</td><td>{s.l}</td><td>{gd(s.gf, s.ga)}</td><td><b>{s.pts}</b></td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  <p class="cg-scroll-note muted fs-xs">{L.standingsScroll}</p>
  {#if list.length}
    <div class="cg-matches">
      {#each list as m (m.id)}<CupMatchRow {m} {teams} {mineId} {onopen} {prediction} />{/each}
    </div>
  {/if}
</details>

<style>
  .cg-identity {display:flex;align-items:center;gap:5px}.cg-who{display:flex;flex-direction:column;gap:3px;min-width:0}.cg-who small{font-size:11px;font-weight:400;overflow-wrap:anywhere}.cg-who b{font-weight:600}.cg-identity .rk{flex-shrink:0}
  button.nm {display:flex;align-items:center;gap:6px;min-width:0;flex:1;border:0;background:transparent;font:inherit;text-align:left;color:inherit;min-height:44px;padding:0;cursor:pointer;}
  .cg {
    padding: 0;
    overflow: hidden;
    border-top: 1px solid var(--line);
  }
  .cg summary {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
    min-height: 44px;
    cursor: pointer;
    list-style: none;
  }
  .cg summary::-webkit-details-marker {
    display: none;
  }
  .cg summary::after {
    content: '▸';
    color: var(--muted);
  }
  .cg[open] summary::after {
    content: '▾';
  }
  .cg-n {
    margin-left: auto;
  }
  .cg[open] summary {
    border-bottom: 1px solid var(--line);
  }
  .cg-scroll-note{display:none;margin:6px 0}@media(max-width:480px){.cg-scroll-note{display:block}}
  .cg-scroll {
    overflow-x: auto;
  }
  .cg-table {
    width: 100%;
    min-width: 400px;
    border-collapse: collapse;
    font-size: 0.8125rem;
    font-variant-numeric: tabular-nums;
  }
  .cg-table th,
  .cg-table td {
    padding: 8px 4px;
    text-align: center;
    white-space: nowrap;
  }
  .cg-table td:nth-child(2) {
    min-width: 0;
  }
  .cg-table th {
    font-weight: 600;
    color: var(--muted);
    font-size: 0.75rem;
  }
  .cg-table .t {
    min-width: 170px;
    text-align: left;
    padding-left: 6px;
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
    padding: 8px 0 0;
    border-top: 1px solid var(--line);
  }
</style>
