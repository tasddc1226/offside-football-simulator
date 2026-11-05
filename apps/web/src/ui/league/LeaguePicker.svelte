<script lang="ts">
  // T-11-640 리그 고르기: 부를 먼저 고르고, 리그가 여럿이면 번호를 고른다(앱 LeaguePicker와 같은 구성).
  import { leagueText as L } from '@offside/app-core/i18n/ko/league';
  import { leagueTierPick, type LeaguePick } from '@offside/app-core/leagueView';

  let { tiers, pick, mine, onpick }: {
    tiers: readonly { tier: number; leagues: number }[];
    pick: LeaguePick;
    mine: LeaguePick | null;
    onpick: (p: LeaguePick) => void;
  } = $props();

  const leagues = $derived(tiers.find((t) => t.tier === pick.tier)?.leagues ?? 1);
  const isMine = $derived(!!mine && mine.tier === pick.tier && mine.league === pick.league);
</script>

<section class="card lp" aria-label={L.pickLeague}>
  <div class="lp-head">
    <b data-league-picked={`${pick.tier}-${pick.league}`}>{L.leagueName(pick)}{#if isMine}<small class="muted"> · {L.myLeague}</small>{/if}</b>
    {#if mine && !isMine}<button class="lp-link" type="button" data-act="league-pick-mine" onclick={() => onpick(mine)}>{L.goMyLeague}</button>{/if}
  </div>
  <div class="lp-row lp-tiers">
    {#each tiers as t (t.tier)}
      <button class="lp-btn" class:on={t.tier === pick.tier} class:mine={mine?.tier === t.tier} type="button" aria-pressed={t.tier === pick.tier} data-league-tier={t.tier} onclick={() => onpick(leagueTierPick(t.tier, mine))}>{L.tierName({ tier: t.tier })}</button>
    {/each}
  </div>
  {#if leagues > 1}
    <div class="lp-row lp-nos">
      {#each Array.from({ length: leagues }, (_, i) => i + 1) as no (no)}
        {@const own = mine?.tier === pick.tier && mine.league === no}
        <button class="lp-btn" class:on={no === pick.league} class:mine={own} type="button" aria-pressed={no === pick.league} aria-label={`${L.leagueName({ tier: pick.tier, league: no })}${own ? ` · ${L.myLeague}` : ''}`} data-league-no={no} onclick={() => onpick({ tier: pick.tier, league: no })}>{no}</button>
      {/each}
    </div>
  {/if}
</section>

<style>
  .lp { display: flex; flex-direction: column; gap: 10px; }
  .lp-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 28px; }
  .lp-head small { font-weight: 400; }
  .lp-link { min-height: 44px; margin: -8px 0; padding: 0 2px; border: 0; background: transparent; color: var(--accent-text); font: inherit; font-size: var(--fs-body2); font-weight: 600; cursor: pointer; }
  .lp-row { display: grid; gap: 6px; }
  .lp-tiers { grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); }
  .lp-nos { grid-template-columns: repeat(auto-fill, minmax(44px, 1fr)); }
  .lp-btn { position: relative; min-height: 44px; padding: 0 2px; border: 1px solid var(--line); border-radius: var(--radius-sm, 8px); background: var(--surface); color: inherit; font: inherit; font-size: var(--fs-body2); font-variant-numeric: tabular-nums; cursor: pointer; }
  .lp-btn.on { border: 2px solid var(--accent); font-weight: 700; }
  .lp-btn.mine::after { content: ''; position: absolute; top: 5px; right: 5px; width: 6px; height: 6px; border-radius: 50%; background: var(--accent); }
</style>
