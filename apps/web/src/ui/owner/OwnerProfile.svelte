<script lang="ts">
  import LeagueHonors from '../league/LeagueHonors.svelte';
  // T-11-150 구단주 프로필 — 팀 프로필의 '구단주 프로필'에서 연다(팀 id로). 시즌을 넘어 쌓이는 기록을 한곳에: 대표 칭호와
  // 지난 시즌 등급, 지금 팀, 영구결번 · 은퇴 선수 · 최고 팀 순위, 컵 트로피 진열장, 시즌별 업적 점수와 팀 순위.
  import { onMount } from 'svelte';
  import { fetchOwnerProfileByTeam, type OwnerProfile } from '@offside/app-core/api/ownerProfile';
  import { tierTitle } from '@offside/app-core/ownerTier';
  import { gradeEmblem } from '@offside/app-core/gradeEmblem';
  import { seasonLabel } from '@offside/app-core/seasonName';
  import { num } from '@offside/app-core/teamText';
  import { ownerProfileText as L } from '@offside/app-core/i18n/ko/ownerProfile';
  import LoadState, { type LoadStatus } from '../LoadState.svelte';
  import OwnerAvatar from '../OwnerAvatar.svelte';
  import GradeEmblem from '../team/GradeEmblem.svelte';
  import TeamLogo from '../team/TeamLogo.svelte';
  import CupHonors from '../cup/CupHonors.svelte';
  import TitleBadge from '../cup/TitleBadge.svelte';
  import { appState } from '../state.svelte.js';
  import { go, openOwnerHallVisit } from '../nav.js';

  let { teamId }: { teamId: string } = $props();

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
  // T-11-694 등급 엠블럼 색을 카드 물들이기 · 아바타 테두리에 쓴다.
  const tierStyle = $derived.by(() => {
    if (!owner?.tier) return '';
    const p = gradeEmblem(owner.tier.tier).palette;
    return `--tier:${p.base}`;
  });
  // T-11-694 최고 순위를 낸 가장 최근 시즌. 칸 이름에 붙여 아래 시즌 표와 겹치지 않게 한다.
  const bestSeason = $derived.by(() => {
    const best = owner?.stats.bestTeamRank;
    if (!owner || !best) return null;
    const s = [...owner.seasons].reverse().find((x) => x.teamRank === best);
    return s ? seasonLabel(s.season, s.name) : null;
  });
</script>

<LoadState {status} failText={L.loadFail} retry={load}>
  {#if owner}
    <div class="op-sections" data-owner-profile>
      <!-- T-11-694 머리 카드: 등급 색으로 위쪽을 물들이고, 엠블럼은 아바타 배지로, 숫자는 한 줄 띠로, 팀 · 명예관은 한 묶음 목록으로. -->
      <section class="card op-head" style={tierStyle}>
        <div class="op-id">
          <span class="op-face" class:op-ring={!!owner.tier}>
            <OwnerAvatar avatarId={owner.avatarId} name={owner.nickname ?? L.noNickname} size={72} />
            {#if owner.tier}<span class="op-crest" title={tierTitle(owner.tier)} data-owner-crest={owner.tier.tier}><GradeEmblem id={owner.tier.tier} size={30} /></span>{/if}
          </span>
          <div class="op-who">
            <span class="eyebrow op-eyebrow">{['Owner profile', owner.tier ? tierTitle(owner.tier) : null, mine ? L.mine : null].filter(Boolean).join(' · ')}</span>
            <h1>{owner.nickname ?? L.noNickname}</h1>
            {#if owner.title}<TitleBadge title={owner.title} />{/if}
          </div>
        </div>
        <dl class="op-strip">
          <div><dd>{num(owner.stats.retiredNumbers)}</dd><dt>{L.statRn}</dt></div>
          <div><dd>{num(owner.stats.retired)}</dd><dt>{L.statRetired}</dt></div>
          <div><dd>{rank(owner.stats.bestTeamRank)}</dd><dt>{L.statBestRank}{#if bestSeason}<small>{bestSeason}</small>{/if}</dt></div>
        </dl>
        <div class="op-links">
          {#if owner.team}
            {@const team = owner.team}
            <button class="op-row" data-act="owner-team" onclick={() => openTeam(team.id)}>
              <TeamLogo logo={team.logo} name={team.name} size={36} decorative />
              <span class="op-row-text">
                <b>{team.name}</b>
                <small class="muted">{L.teamLine({ season: seasonLabel(team.season, team.seasonName), manager: team.manager })}</small>
              </span>
              <span class="sr-only">{L.openTeam}</span><span class="op-go" aria-hidden="true">›</span>
            </button>
          {/if}
          {#if mine}
            <button class="op-row" data-act="owner-hall" onclick={() => go('honors')}><span class="op-row-text"><b>{L.manage}</b></span><span class="op-go" aria-hidden="true">›</span></button>
          {:else}
            <button class="op-row" data-act="owner-hall-visit" onclick={() => openOwnerHallVisit(teamId)}><span class="op-row-text"><b>{L.openHall}</b></span><span class="op-go" aria-hidden="true">›</span></button>
          {/if}
        </div>
      </section>

      <LeagueHonors honors={owner.leagueHonors ?? []} />
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

<style>
  .op-sections {display:flex; flex-direction:column; gap:14px;}
  .op-head {display:flex; flex-direction:column; gap:16px; overflow:hidden; --tier:var(--line); --tier-text:color-mix(in srgb, var(--tier) 62%, var(--ink));
    background-image:radial-gradient(130% 90% at 0% 0%, color-mix(in srgb, var(--tier) 26%, transparent), transparent 62%);}
  .op-id {display:flex; align-items:center; gap:16px;}
  .op-face {position:relative; flex:none; border-radius:50%;}
  .op-ring {box-shadow:0 0 0 3px var(--surface), 0 0 0 5px var(--tier);}
  .op-crest {position:absolute; right:-8px; bottom:-6px; display:inline-flex;}
  .op-who {display:flex; flex-direction:column; align-items:flex-start; gap:6px; min-width:0;}
  .op-eyebrow {color:var(--tier-text);}
  .op-who h1 {margin:0; font-size:var(--fs-title1, 28px); line-height:1.15; overflow-wrap:anywhere;}
  .op-strip {display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); margin:0; padding:12px 0; border-radius:var(--radius-md); background:var(--surface-2);}
  .op-strip div {display:flex; flex-direction:column; align-items:center; gap:2px; min-width:0; padding:0 6px; text-align:center;}
  .op-strip div + div {border-left:1px solid var(--line);}
  .op-strip dd {margin:0; font-family:var(--display); font-size:var(--fs-title2, 24px); font-weight:700; line-height:1.1; font-variant-numeric:tabular-nums;}
  .op-strip dt {font-size:var(--fs-caption, 12px); color:var(--muted);}
  .op-strip small {display:block; font-size:11px; color:var(--tier-text);}
  .op-links {display:flex; flex-direction:column; border-radius:var(--radius-md); background:var(--surface-2); overflow:hidden;}
  .op-row {display:flex; align-items:center; gap:12px; width:100%; min-height:48px; padding:10px 14px; border:0; background:transparent; color:inherit; font:inherit; text-align:left; cursor:pointer;}
  .op-row + .op-row {border-top:1px solid var(--line);}
  .op-row:hover {background:color-mix(in srgb, currentColor 6%, transparent);}
  .op-row:focus-visible {outline:2px solid var(--accent); outline-offset:-2px;}
  .op-row-text {display:flex; flex-direction:column; min-width:0; flex:1;}
  .op-row-text b {overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
  .op-go {color:var(--muted); font-size:20px; line-height:1;}
  .op-table {width:100%; border-collapse:collapse; font-size:var(--fs-label, 14px);}
  .op-table th {font-size:var(--fs-caption, 12px); font-weight:600; color:var(--muted); text-align:left; padding:0 4px 6px;}
  .op-table td {padding:8px 4px; border-top:1px solid var(--line);}
  .op-table .num {text-align:right; font-variant-numeric:tabular-nums;}
  .op-team-cell {max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
  .op-live {margin-left:6px; font-size:10px;}
</style>
