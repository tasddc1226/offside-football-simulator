<script lang="ts">
  // T-11-640 리그 고르기: 지금 보는 리그 이름을 크게 두고 앞뒤로 넘긴다. 이름을 누르면 부마다 묶은 이름표가 올라온다(앱 LeaguePicker와 같은 구성).
  import { leagueText as L } from '@offside/app-core/i18n/ko/league';
  import { leagueStep, leagueTierGroups, leagueTitle, type LeaguePick } from '@offside/app-core/leagueView';
  import PopSheet from '../PopSheet.svelte';
  import LeagueEmblem from './LeagueEmblem.svelte';
  import LeagueTrophy from './LeagueTrophy.svelte';

  let { tiers, pick, mine, onpick }: {
    tiers: readonly { tier: number; leagues: number }[];
    pick: LeaguePick;
    mine: LeaguePick | null;
    onpick: (p: LeaguePick) => void;
  } = $props();

  let open = $state(false);
  const groups = $derived(leagueTierGroups(tiers));
  const flat = $derived(groups.flatMap((g) => g.leagues));
  const prev = $derived(leagueStep(flat, pick, -1));
  const next = $derived(leagueStep(flat, pick, 1));
  const isMine = $derived(!!mine && mine.tier === pick.tier && mine.league === pick.league);
  function choose(p: LeaguePick) {
    open = false;
    onpick({ tier: p.tier, league: p.league });
  }
</script>

<section class="card lp" aria-label={L.pickLeague}>
  <div class="lp-step">
    <button class="lp-arrow" type="button" data-act="league-prev" aria-label={L.leaguePrev} disabled={!prev} onclick={() => prev && choose(prev)}>‹</button>
    <button class="lp-now" type="button" data-act="league-pick-open" aria-haspopup="dialog" aria-label={`${L.pickLeague} · ${leagueTitle(pick)}`} onclick={() => (open = true)}>
      <LeagueEmblem tier={pick.tier} league={pick.league} size={52} />
      <small class="muted">{isMine ? `${L.tierName({ tier: pick.tier })} · ${L.myLeague}` : L.tierName({ tier: pick.tier })}</small>
      <b data-league-picked={`${pick.tier}-${pick.league}`}>{leagueTitle(pick)} <span aria-hidden="true">▾</span></b>
    </button>
    <button class="lp-arrow" type="button" data-act="league-next" aria-label={L.leagueNext} disabled={!next} onclick={() => next && choose(next)}>›</button>
  </div>
  <div class="lp-trophy" data-league-trophy-row>
    <LeagueTrophy tier={pick.tier} league={pick.league} size={56} />
    <span><b>{L.trophyTitle}</b><small class="muted">{L.trophyNote}</small></span>
  </div>
  {#if mine && !isMine}<button class="lp-link" type="button" data-act="league-pick-mine" onclick={() => choose(mine)}>{L.goMyLeague}</button>{/if}
</section>

{#if open}
  <PopSheet label={L.pickLeague} onclose={() => (open = false)}>
    <div class="lp-sheet">
      <h2>{L.pickLeague}</h2>
      {#each groups as g (g.tier)}
        <section data-league-group={g.tier}>
          <h3>{g.label}</h3>
          <div class="lp-names" class:one={g.leagues.length === 1}>
            {#each g.leagues as l (l.league)}
              {@const own = mine?.tier === l.tier && mine.league === l.league}
              <button class="lp-name" class:on={l.tier === pick.tier && l.league === pick.league} type="button" aria-pressed={l.tier === pick.tier && l.league === pick.league} data-league-pick={`${l.tier}-${l.league}`} onclick={() => choose(l)}>
                <LeagueEmblem tier={l.tier} league={l.league} size={28} /><span>{l.title}{#if own}<small>{L.myLeague}</small>{/if}</span>
              </button>
            {/each}
          </div>
        </section>
      {/each}
      <button class="btn lp-close" type="button" data-act="league-pick-close" onclick={() => (open = false)}>{L.sheetClose}</button>
    </div>
  </PopSheet>
{/if}

<style>
  .lp { display: flex; flex-direction: column; gap: 6px; }
  .lp-step { display: grid; grid-template-columns: 44px minmax(0, 1fr) 44px; align-items: stretch; gap: 4px; }
  .lp-arrow { min-height: 56px; border: 0; border-radius: var(--radius-sm, 8px); background: transparent; color: inherit; font-size: 24px; line-height: 1; cursor: pointer; }
  .lp-arrow:disabled { opacity: 0.3; cursor: default; }
  .lp-now { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; min-width: 0; padding: 4px; border: 0; border-radius: var(--radius-sm, 8px); background: transparent; color: inherit; font: inherit; cursor: pointer; }
  .lp-now b { font-family: var(--display); font-size: var(--fs-h3, 18px); overflow-wrap: anywhere; }
  .lp-now b span { font-size: 12px; color: var(--muted); }
  .lp-now small { font-size: var(--fs-caption); }
  .lp-trophy { display: flex; align-items: center; gap: 10px; padding-top: 8px; border-top: 1px solid var(--line); }
  .lp-trophy span { display: flex; flex-direction: column; gap: 2px; min-width: 0; overflow-wrap: anywhere; }
  .lp-trophy b { font-size: var(--fs-body2); }
  .lp-trophy small { font-size: var(--fs-caption); }
  .lp-link { align-self: center; min-height: 44px; margin: -4px 0; padding: 0 8px; border: 0; background: transparent; color: var(--accent-text); font: inherit; font-size: var(--fs-body2); font-weight: 600; cursor: pointer; }
  .lp-sheet { display: flex; flex-direction: column; gap: 16px; }
  .lp-sheet h2, .lp-sheet h3 { margin: 0; }
  .lp-sheet h3 { margin-bottom: 8px; font-size: var(--fs-label); font-weight: 600; color: var(--muted); }
  .lp-names { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
  .lp-names.one { grid-template-columns: minmax(0, 1fr); }
  .lp-name { display: flex; align-items: center; justify-content: space-between; gap: 6px; min-height: 48px; padding: 6px 10px; border: 1px solid var(--line); border-radius: var(--radius-sm, 8px); background: var(--surface); color: inherit; font: inherit; font-size: var(--fs-body2); text-align: left; cursor: pointer; }
  .lp-name span { display: flex; flex-direction: column; flex: 1; min-width: 0; text-align: left; overflow-wrap: anywhere; }
  .lp-name small { font-size: 11px; font-weight: 700; color: var(--accent-text); }
  .lp-name.on { border: 2px solid var(--accent); font-weight: 700; }
  .lp-close { min-height: 44px; }
</style>
