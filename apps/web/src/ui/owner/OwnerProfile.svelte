<script lang="ts">
  // T-11-150 구단주 프로필 — 팀 프로필의 '구단주 프로필'에서 연다(팀 id로). 시즌을 넘어 쌓이는 기록을 한곳에: 대표 칭호와
  // 지난 시즌 등급, 지금 팀, 영구결번 · 은퇴 선수 · 최고 팀 순위, 컵 트로피 진열장, 시즌별 업적 점수와 팀 순위.
  import { onMount } from 'svelte';
  import { fetchOwnerProfileByTeam, type OwnerProfile } from '@offside/app-core/api/ownerProfile';
  import { tierTitle } from '@offside/app-core/ownerTier';
  import { seasonLabel } from '@offside/app-core/seasonName';
  import { num } from '@offside/app-core/teamText';
  import { ownerProfileText as L } from '@offside/app-core/i18n/ko/ownerProfile';
  import LoadState, { type LoadStatus } from '../LoadState.svelte';
  import BackBar from '../BackBar.svelte';
  import OwnerAvatar from '../OwnerAvatar.svelte';
  import GradeEmblem from '../team/GradeEmblem.svelte';
  import TeamLogo from '../team/TeamLogo.svelte';
  import CupHonors from '../cup/CupHonors.svelte';
  import TitleBadge from '../cup/TitleBadge.svelte';
  import { appState } from '../state.svelte.js';
  import { go } from '../nav.js';

  let { teamId, onback }: { teamId: string; onback: () => void } = $props();

  let status = $state<LoadStatus>('loading');
  let owner = $state<OwnerProfile | null>(null);
  let mine = $state(false);

  async function load() {
    status = 'loading';
    const r = await fetchOwnerProfileByTeam(teamId);
    if (!r.ok) {
      status = 'error';
      return;
    }
    ({ owner, mine } = r.data);
    status = 'ready';
  }
  onMount(() => void load());

  function openTeam(id: string) {
    appState.hof = { ...appState.hof, team: id, owner: false };
    window.scrollTo(0, 0);
  }
  const rank = (n: number | null) => (n ? L.rank({ n }) : L.none);
</script>

<LoadState {status} failText={L.loadFail} retry={load}>
  {#if owner}
    <div class="op-sections" data-owner-profile>
      <section class="card stack" style="gap:12px">
        <div class="op-id">
          <OwnerAvatar avatarId={owner.avatarId} name={owner.nickname ?? L.noNickname} size={56} />
          <div class="op-who">
            <span class="eyebrow">Owner profile{mine ? ` · ${L.mine}` : ''}</span>
            <h1>
              {#if owner.tier}<span class="op-tier" title={tierTitle(owner.tier)} data-owner-crest={owner.tier.tier}><GradeEmblem id={owner.tier.tier} size={26} /></span>{/if}
              {owner.nickname ?? L.noNickname}
            </h1>
            {#if owner.title}<TitleBadge title={owner.title} />{/if}
            {#if owner.tier}<span class="ach-grade op-grade" data-grade={owner.tier.tier}>{tierTitle(owner.tier)}</span>{/if}
          </div>
        </div>
        {#if owner.team}
          {@const team = owner.team}
          <button class="op-team" data-act="owner-team" onclick={() => openTeam(team.id)}>
            <TeamLogo logo={team.logo} name={team.name} size={32} decorative />
            <span class="op-team-text">
              <b>{team.name}</b>
              <small class="muted">{L.teamLine({ season: seasonLabel(team.season, team.seasonName), manager: team.manager })}</small>
            </span>
            <span class="muted fs-sm">{L.openTeam} ›</span>
          </button>
        {/if}
        <dl class="recap-stats op-stats">
          <div><dt>{L.statRn}</dt><dd>{num(owner.stats.retiredNumbers)}</dd></div>
          <div><dt>{L.statRetired}</dt><dd>{num(owner.stats.retired)}</dd></div>
          <div><dt>{L.statBestRank}</dt><dd>{rank(owner.stats.bestTeamRank)}</dd></div>
        </dl>
        {#if mine}<button class="btn btn-sm" data-act="owner-hall" onclick={() => go('honors')}>{L.manage}</button>{/if}
      </section>

      {#if owner.cupHonors.length}
        <CupHonors honors={owner.cupHonors} />
      {:else}
        <section class="card stack" style="gap:6px">
          <div class="eyebrow">Offside Cup</div>
          <p class="empty">{L.trophiesEmpty}</p>
        </section>
      {/if}

      <section class="card stack" style="gap:10px" data-owner-seasons>
        <div>
          <div class="eyebrow">Seasons</div>
          <h2>{L.seasons}</h2>
        </div>
        {#if owner.seasons.length}
          <table class="op-table">
            <thead><tr><th>{L.colSeason}</th><th>{L.colTeam}</th><th class="num">{L.colAch}</th><th class="num">{L.colRank}</th></tr></thead>
            <tbody>
              {#each [...owner.seasons].reverse() as s (s.season)}
                <tr data-owner-season={s.season}>
                  <td>{seasonLabel(s.season, s.name)}{#if !s.closed}<small class="pill op-live">{L.ongoing}</small>{/if}</td>
                  <td class="op-team-cell" title={s.teamName ?? ''}>{s.teamName ?? L.none}</td>
                  <td class="num">{s.achScore === null ? L.none : num(s.achScore)}</td>
                  <td class="num">{rank(s.teamRank)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {:else}
          <p class="empty">{L.seasonsEmpty}</p>
        {/if}
      </section>
    </div>
  {/if}
</LoadState>
<BackBar act="owner-profile-back" fallback={onback} atBottom={false} />

<style>
  .op-sections {display:flex; flex-direction:column; gap:14px;}
  .op-id {display:flex; align-items:center; gap:12px;}
  .op-who {display:flex; flex-direction:column; align-items:flex-start; gap:4px; min-width:0;}
  .op-who h1 {display:flex; align-items:center; gap:6px; margin:0; overflow-wrap:anywhere;}
  .op-tier {display:inline-flex;}
  .op-grade {font-size:var(--fs-xs, 12px);}
  .op-team {display:flex; align-items:center; gap:10px; width:100%; padding:10px 12px; border:0; border-radius:12px; background:var(--surface-2); color:inherit; font:inherit; text-align:left; cursor:pointer;}
  .op-team-text {display:flex; flex-direction:column; min-width:0; flex:1;}
  .op-team-text b {overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
  .op-stats {grid-template-columns:repeat(3, minmax(0, 1fr));}
  .op-table {width:100%; border-collapse:collapse; font-size:var(--fs-sm, 14px);}
  .op-table th {font-size:var(--fs-xs, 12px); font-weight:600; color:var(--muted); text-align:left; padding:0 4px 6px;}
  .op-table td {padding:8px 4px; border-top:1px solid var(--line);}
  .op-table .num {text-align:right; font-variant-numeric:tabular-nums;}
  .op-team-cell {max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
  .op-live {margin-left:6px; font-size:10px;}
</style>
