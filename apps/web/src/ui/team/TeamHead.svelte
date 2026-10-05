<script lang="ts">
  // 팀 소개는 작게, 편성 그라운드는 바로 아래에. 보조 동작은 팀 메뉴에 모은다.
  import { tick } from 'svelte';
  import { MANAGER_NAME_MAX, MANAGER_NAME_MIN, TEAM_NAME_MAX, TEAM_NAME_MIN, YOUTH_OVR } from '@offside/contracts/owner-team';
  import type { OwnerTeam, OwnerTeamResponse } from '@offside/app-core/api/team';
  import { num, recordText } from '@offside/app-core/teamText';
  import { doneOnEnter } from '../inputDone.js';
  import { teamHomeText as L } from '@offside/app-core/i18n/ko/teamHome';
  import TeamLogo from './TeamLogo.svelte';
  import type { TeamLogo as Logo } from '@offside/contracts/team-logo';

  let {
    team,
    logo,
    onlogo,
    seasonName,
    editable,
    dirty,
    ovr,
    matchesLeft,
    perDay,
    seasons,
    season,
    current,
    name = $bindable(),
    manager = $bindable(),
    renaming = $bindable(),
    onseason,
  }: {
    team: OwnerTeam | null;
    logo: Logo | null;
    onlogo: () => void;
    seasonName: string;
    editable: boolean;
    dirty: boolean;
    ovr: number;
    matchesLeft: number;
    perDay: number;
    seasons: OwnerTeamResponse['seasons'];
    season: number;
    current: number | null;
    name: string;
    manager: string;
    /** 팀이 있으면 이름 칸은 '이름 바꾸기'를 눌렀을 때만 펼친다. */
    renaming: boolean;
    onseason: (id: number) => void;
  } = $props();
  let menuOpen = $state(false);
  let menu = $state<HTMLDetailsElement>();
  let teamNameInput = $state<HTMLInputElement>();

  function closeMenu(restoreFocus = false) {
    menuOpen = false;
    if (restoreFocus) menu?.querySelector('summary')?.focus();
  }
  async function rename() {
    closeMenu();
    renaming = true;
    await tick();
    teamNameInput?.focus();
  }
</script>

<svelte:window onpointerdown={(e) => { if (menuOpen && !menu?.contains(e.target as Node)) closeMenu(); }}
  onfocusin={(e) => { if (menuOpen && !menu?.contains(e.target as Node)) closeMenu(); }}
  onkeydown={(e) => { if (menuOpen && e.key === 'Escape') { e.preventDefault(); closeMenu(true); } }} />

<section class="card tm-head">
  <div class="tm-top">
    {#if seasons.length > 1}
      <select class="tm-season" aria-label={L.seasonSelect} value={season} onchange={(e) => { closeMenu(); onseason(Number(e.currentTarget.value)); }} data-team-season>
        {#each seasons as o (o.id)}
          <option value={o.id}>{o.name}{o.id === current ? L.seasonNow : ''}</option>
        {/each}
      </select>
    {:else}<span class="tm-season-name">{seasonName}</span>{/if}
    {#if editable}
    <details class="tm-menu" bind:this={menu} bind:open={menuOpen}>
      <summary aria-label={L.teamMenu} aria-expanded={menuOpen} data-act="team-menu"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg></summary>
      <div class="tm-menu-items">
        {#if editable}<button onclick={() => { closeMenu(); onlogo(); }} data-act="team-logo">{L.menuLogo}</button>{/if}
        {#if editable && team && !renaming}<button onclick={rename} data-act="team-rename">{L.menuRename}</button>{/if}
      </div>
    </details>
    {/if}
  </div>
  <div class="tm-title">
    <div class="tm-identity">
      {#if editable}<button class="tm-logo-edit" aria-label={L.logoOpen} data-act="team-logo-open" onclick={onlogo}><TeamLogo {logo} name={name.trim() || L.myTeam} /></button>
      {:else}<TeamLogo {logo} name={team?.name ?? L.myTeam} />{/if}
      <div class="tm-identity-text">
      <h1>{editable ? name.trim() || (team ? L.titleEnterName : L.createTeam) : team?.name ?? L.noTeam}</h1>
      {#if team}<span class="muted fs-sm">{manager.trim() || !editable ? L.managerLine({ name: editable ? manager.trim() : team.manager }) : L.managerEnter}{#if editable && dirty}<small class="tm-draft">{L.unsaved}</small>{/if}</span>{/if}
      </div>
    </div>
    <div class="tm-ovr-badge" aria-label={L.teamOvr({ n: ovr })}><small>OVR</small><b>{ovr}</b></div>
  </div>
  {#if team}
    <dl class="tm-stats" data-team-record>
      <div class="tm-record"><dt class="sr-only">{L.statRecord}</dt><dd>{recordText(team.record)}</dd></div>
      <div><dt>{L.statRating}</dt><dd>{num(team.rating)}</dd></div>
      <div aria-label={editable ? L.leftAria({ left: matchesLeft, per: perDay }) : undefined}><dt>{editable ? L.statLeft : L.statSeason}</dt><dd>{editable ? L.statTimes({ n: matchesLeft }) : L.statPast}</dd></div>
    </dl>
  {:else if editable}
    <p class="muted">{L.introNew({ season: seasonName, ovr: YOUTH_OVR })}</p>
  {:else}
    <p class="muted">{L.introNone({ season: seasonName })}</p>
  {/if}
  {#if !editable && team}
    <p class="muted fs-sm" data-team-readonly>{L.readonlyNote}</p>
  {/if}
  {#if editable && (!team || renaming)}
    <div class="tm-names">
      <label class="field">
        <span class="lbl">{L.teamNameLabel}</span>
        <input type="text" bind:this={teamNameInput} bind:value={name} minlength={TEAM_NAME_MIN} maxlength={TEAM_NAME_MAX} placeholder={L.charsRange({ min: TEAM_NAME_MIN, max: TEAM_NAME_MAX })} data-team-name enterkeyhint="done" autocapitalize="off" autocorrect="off" spellcheck="false" use:doneOnEnter />
      </label>
      <label class="field">
        <span class="lbl">{L.managerNameLabel}</span>
        <input type="text" bind:value={manager} minlength={MANAGER_NAME_MIN} maxlength={MANAGER_NAME_MAX} placeholder={L.charsRange({ min: MANAGER_NAME_MIN, max: MANAGER_NAME_MAX })} data-team-manager enterkeyhint="done" autocapitalize="off" autocorrect="off" spellcheck="false" use:doneOnEnter />
      </label>
    </div>
  {/if}
</section>

<style>
  .tm-head {display:flex;flex-direction:column;gap:8px;padding:8px 16px 16px;}
  .tm-top {display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:44px;}
  .tm-season-name,.tm-season {font-size:12px;font-weight:600;color:var(--muted);}
  .tm-season {max-width:calc(100% - 52px);min-height:44px;padding:0 24px 0 0;border:0;border-radius:6px;background:transparent;color:var(--muted);font-family:inherit;cursor:pointer;}
  .tm-menu {position:relative;flex:none;}
  .tm-menu summary {display:flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:8px;list-style:none;cursor:pointer;color:var(--muted);}
  .tm-menu summary::-webkit-details-marker {display:none;}
  .tm-menu summary svg {width:22px;height:22px;fill:currentColor;}
  .tm-menu[open] summary {background:var(--surface-2);color:var(--ink);}
  .tm-menu-items {position:absolute;top:calc(100% + 4px);right:0;z-index:50;width:184px;padding:6px;border:1px solid var(--line);border-radius:12px;background:var(--surface);box-shadow:var(--shadow);}
  .tm-menu-items button {display:block;width:100%;min-height:44px;padding:10px;border:0;border-radius:6px;background:none;color:var(--ink);text-align:left;font:inherit;font-size:14px;font-weight:600;cursor:pointer;}
  .tm-menu-items button:hover,.tm-menu-items button:active {background:var(--surface-2);}
  .tm-title {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }
  .tm-title h1 {
    margin:0;font-size:28px;line-height:1.25;
    overflow-wrap: anywhere;
  }
  .tm-identity {display:flex;align-items:center;gap:10px;min-width:0;}
  .tm-identity-text {min-width:0;}
  .tm-identity-text > span {display:block;margin-top:4px;font-size:12px;overflow-wrap:anywhere;}
  .tm-draft {display:inline-block;margin-left:6px;padding:1px 5px;border:1px solid var(--line);border-radius:4px;font-size:11px;color:var(--accent-text);}
  .tm-logo-edit {display:flex;align-items:center;justify-content:center;flex:none;width:48px;height:48px;padding:0;border:0;border-radius:8px;background:none;color:inherit;cursor:pointer;}
  .tm-ovr-badge {
    flex: none;
    display: grid;
    place-items: center;
    min-width: 58px;
    gap:4px;
    padding: 8px 10px;
    border-radius: 10px;
    background: var(--pitch);
    color: var(--on-pitch);
    line-height: 1.1;
  }
  .tm-ovr-badge small {
    font-family: var(--display);
    font-size: 0.6875rem;
    letter-spacing: 0.06em;
  }
  .tm-ovr-badge b {
    font-family: var(--display);
    font-size: 36px;
    line-height:1;
    color: var(--pitch-accent);
  }
  .tm-stats {
    display: grid;
    grid-template-columns: 1.25fr 1fr 1.1fr;
    gap: 0;
    margin: 0;
    padding-top:4px;
  }
  .tm-stats div {
    display: flex;
    align-items:center;
    justify-content:center;
    flex-wrap:wrap;
    gap: 2px 5px;
    padding: 0 8px;
    border-left:1px solid var(--line);
    min-width: 0;
    line-height:1.6;
  }
  .tm-stats .tm-record {justify-content:flex-start;border-left:0;padding-left:0;}
  .tm-stats div:last-child {padding-right:0;}
  .tm-stats dt {
    font-size: 0.75rem;
    color: var(--muted);
  }
  .tm-stats dd {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }
  .tm-names {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .tm-names {margin-top:4px;}
  .tm-head > p {margin:0;font-size:13px;line-height:1.6;}
</style>
