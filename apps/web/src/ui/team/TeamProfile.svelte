<script lang="ts">
  import { seasonLabel } from '@offside/app-core/seasonName';
  import { shapeOf } from '@offside/contracts/owner-team';
  // T-10-092 팀 프로필(라이브 랭킹에서 연다) — 시즌 순위 · 감독 · 레이팅 · 선발 그라운드 · 줄 힘 · 좋아요/조회수 · 팀 히스토리
  // 배지. 누구나 본다. 남의 팀을 열면 조회수를 한 번 올린다(내 팀은 세지 않는다).
  // T-11-335 감독 칸에 앉힌 감독(이름 · 등급 · 포메이션 효과)과 줄 힘의 감독 보정을 내 팀 화면처럼 보인다.
  import { onMount } from 'svelte';
  import {
    fetchPublicTeamStats,
    fetchTeamProfile,
    likeTeam,
    viewTeam,
    type TeamProfile,
    type TeamStatsResponse,
  } from '@offside/app-core/api/team';
  import { requestFriend, type FriendState } from '@offside/app-core/api/friends';
  import { teamSeasonClosed } from '@offside/contracts/service-seasons';
  import { localCareerNames } from '@offside/game/hof-store';
  import { toast } from '../helpers.js';
  import LoadState, { type LoadStatus } from '../LoadState.svelte';
  import NameReport from '../NameReport.svelte';
  import NameReports from '../NameReports.svelte';
  import TeamLines from './TeamLines.svelte';
  import TeamSynergy from './TeamSynergy.svelte';
  import { synergyFocus } from '@offside/app-core/teamOwner';
  import { coachLineBonus, coachSummary } from '@offside/app-core/managerCard';
  import { managerText as MG } from '@offside/app-core/i18n/ko/manager';
  import TeamPitch from './TeamPitch.svelte';
  import TeamLogo from './TeamLogo.svelte';
  import CupHonors from '../cup/CupHonors.svelte';
  import TeamComments from './TeamComments.svelte';
  import TitleBadge from '../cup/TitleBadge.svelte';
  import { ownerProfileText as LO } from '@offside/app-core/i18n/ko/ownerProfile';
  import { appState } from '../state.svelte.js';
  import { num as n, recordText } from '@offside/app-core/teamText';
  import { friendRequestText } from '@offside/app-core/friendText';
  import { friendText as LF } from '@offside/app-core/i18n/ko/friend';
  import { teamAchText as L } from '@offside/app-core/i18n/ko/teamAch';
  import { teamMatchText as LM } from '@offside/app-core/i18n/ko/teamMatch';
  import type { Component } from 'svelte';

  let { id }: { id: string } = $props();

  let status = $state<LoadStatus>('loading');
  let team = $state<TeamProfile | null>(null);
  let liked = $state(false);
  let mine = $state(false);
  let liking = $state(false);
  /** T-11-098 나와 이 팀 구단주의 친구 상태(로그인한 구단주가 남의 팀을 볼 때만 온다). */
  let friend = $state<FriendState | null>(null);
  let befriending = $state(false);
  // T-11-290 시너지 표에서 고른 항목 — 그라운드에서 그 선수들을 잇는다(내 팀 TeamLineup과 같은 동작, 읽기 전용).
  let synFocus = $state<string | null>(null);
  const syn = $derived(team?.synergy ? synergyFocus(team.synergy, synFocus) : null);
  const coachBonus = $derived(
    team?.coach ? coachLineBonus(team.coach, team.formation, team.synergy ?? null, team.season) : null,
  );
  // T-11-029 끝난 시즌의 팀은 좋아요가 굳는다(서버가 409로 거절한다).
  const closed = $derived(!!team && teamSeasonClosed(team.season, new Date().toISOString()));

  // 내 팀이면 이 기기에 남은 (비공개) 이름으로 보여 준다.
  const localNames = localCareerNames();

  async function load() {
    status = 'loading';
    const r = await fetchTeamProfile(id);
    if (!r.ok) {
      status = 'error';
      return;
    }
    ({ team, liked, mine } = r.data);
    friend = r.data.friend ?? null;
    status = 'ready';
    if (!mine) {
      team.views += 1;
      void viewTeam(id);
    }
  }
  onMount(() => void load());

  /** T-11-150 이 팀 구단주의 프로필(뒤로 가면 이 팀 프로필로). */
  function openOwner() {
    appState.hof = { ...appState.hof, owner: true };
    window.scrollTo(0, 0);
  }

  async function toggleLike() {
    if (!team || liking) return;
    liking = true;
    const r = await likeTeam(team.id, !liked);
    liking = false;
    if (!r.ok) return toast(r.error.message);
    liked = r.data.liked;
    team.likes = r.data.likes;
  }

  /** 친구 신청 · 받은 신청 수락(같은 요청 — 상대가 먼저 신청했으면 서버가 바로 친구로 맺는다). */
  async function befriend() {
    if (!team || befriending) return;
    befriending = true;
    const r = await requestFriend({ teamId: team.id });
    befriending = false;
    if (!r.ok) return toast(r.error.message);
    friend = r.data.state;
    toast(friendRequestText(r.data));
  }
  const friendButton = (s: FriendState): string =>
    ({ none: LF.reqNone, sent: LF.reqSent, received: LF.reqReceived, accepted: LF.reqAccepted })[s];

  // T-11-358 경기 통계 — '경기 통계 보기'를 누를 때만 화면 조각(지연 청크)과 통계를 불러온다.
  let statsOpen = $state(false);
  let statsStatus = $state<LoadStatus>('loading');
  let stats = $state<TeamStatsResponse | null>(null);
  let StatsView = $state<Component<any> | null>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  async function loadStats() {
    statsStatus = 'loading';
    const [view, r] = await Promise.all([
      StatsView ? null : import('./TeamStats.svelte').catch(() => null),
      fetchPublicTeamStats(id),
    ]);
    if (view) StatsView = view.default;
    if (!r.ok || !StatsView) {
      statsStatus = 'error';
      return;
    }
    stats = r.data;
    statsStatus = 'ready';
  }
  function openStats() {
    statsOpen = true;
    if (!stats) void loadStats();
  }
  const statsName = (_id: string | null, fallback: string) =>
    (mine && _id && localNames.get(_id)) || fallback;

  // T-11-165 선발 선수 카드 — 그라운드 카드를 누르면 내 팀처럼 확대 카드가 열린다(배포 전 응답엔 없다).
  const players = $derived(new Map(team?.players?.map((p) => [p.careerId, p]) ?? []));
  const cells = $derived(
    team?.slots.map((s) => ({
      rating: s.rating,
      nation: s.nation,
      season: s.season,
      name: (mine && s.careerId && localNames.get(s.careerId)) || s.name,
      youth: s.careerId === null,
      player: s.careerId ? players.get(s.careerId) : undefined,
    })) ?? [],
  );
</script>

<LoadState {status} failText={L.profLoadFail} retry={load}>
  {#if team}
    <!-- 기록실 탭 패널 안이라 화면(.wrap)의 카드 간격이 닿지 않는다 — 같은 14px로 섹션을 띄운다. -->
    <div class="tp-sections">
    <!-- T-11-290 머리 정리 — 순위는 한 번만, 포메이션은 정체성 줄로, 감독·구단주·칭호는 한 줄의 링크(줄 전체가 구단주 프로필). -->
    <section class="card stack tp-head" style="gap:10px" data-team-profile={team.id}>
      <span class="eyebrow">Team profile</span>
      <div class="tp-title">
        <div class="tp-identity"><TeamLogo logo={team.logo} name={team.name} size={56} /><div class="tp-names">
          <h1>{team.name}</h1>
          <small class="muted">{seasonLabel(team.season, team.seasonName)}{team.rank ? ` · RANK #${team.rank}` : ''} · {shapeOf(team.formation, team.layout)}</small>
        </div></div>
        <div class="tp-rating" aria-label={L.profRatingAria({ n: team.rating })}><small>RATING</small><b>{n(team.rating)}</b></div>
      </div>
      <button class="tp-people" data-act="owner-profile" onclick={openOwner}>
        <span class="tp-people-text muted fs-sm">
          {#if team.ownerNickname && team.ownerNickname === team.manager}
            <span data-team-owner>{L.profManagerOwner}<b class="tp-manager">{team.manager}</b>{mine ? L.profMine : ''}</span>
          {:else}
            <span>{L.profManager}<b class="tp-manager">{team.manager}</b>{mine ? L.profMine : ''}</span>
            {#if team.ownerNickname}<span data-team-owner>{L.profOwner}<b class="tp-manager">{team.ownerNickname}</b></span>{/if}
          {/if}
          {#if team.ownerTitle}<TitleBadge title={team.ownerTitle} size="sm" />{/if}
        </span>
        <span class="tp-people-go muted fs-sm">{LO.open} ›</span>
      </button>
      <dl class="tp-stats">
        <div><dt>{L.profStatOvr}</dt><dd>{team.ovr}</dd></div>
        <div><dt>{L.profStatRecord}</dt><dd>{recordText(team.record)}</dd></div>
        <div><dt>{L.profStatGoals}</dt><dd>{team.goals.for} : {team.goals.against}</dd></div>
      </dl>
    </section>

    <TeamPitch formation={team.formation} layout={team.layout} {cells} links={syn?.links ?? []} focus={syn?.members ?? null} applied={syn?.applied ?? []} caption={syn ? syn.caption : null} />

    <section class="card stack" style="gap:12px">
      {#if team.coach}
        <div class="tp-coach" data-team-profile-coach>
          <b>{MG.profileCoach}</b>
          <span class="muted fs-sm">{coachSummary(team.coach, team.formation, localNames)}</span>
        </div>
      {/if}
      <TeamLines lines={team.lines} coach={coachBonus} />
      {#if team.synergy}<div class="tp-syn" data-team-profile-synergy><TeamSynergy synergy={team.synergy} season={team.season} bind:focus={synFocus} /></div>{/if}
      <div class="tp-social">
        <button class="tp-like" aria-pressed={liked} disabled={mine || liking || closed} onclick={toggleLike} data-act="team-like" aria-label={L.profLikeAria({ n: team.likes })}>
          <span aria-hidden="true">{liked ? '♥' : '♡'}</span> {n(team.likes)}
        </button>
        <span class="muted">{L.profViews}<b>{n(team.views)}</b></span>
        {#if friend}<button class="btn btn-sm" class:btn-primary={friend === 'none' || friend === 'received'} disabled={befriending || friend === 'sent' || friend === 'accepted'} onclick={befriend} data-act="team-friend" data-friend-state={friend}>{friendButton(friend)}</button>{/if}
      </div>
    </section>

    <section class="card stack" style="gap:10px" data-team-history>
      <div>
        <div class="eyebrow">Team history</div>
        <h2>{L.profHistoryTitle}</h2>
      </div>
      {#if team.badges.length}
        <ul class="tp-badges">
          {#each team.badges as b (b.id)}
            <li data-badge={b.id} class:final={b.id.startsWith('final-')}><b>{b.label}</b><small class="muted">{b.desc}</small></li>
          {/each}
        </ul>
      {:else}
        <p class="empty">{L.profHistoryEmpty}</p>
      {/if}
    </section>
    {#if team.cupHonors?.length}<CupHonors honors={team.cupHonors} />{/if}
    {#if statsOpen && StatsView}
      <StatsView {stats} status={statsStatus} seasonName={seasonLabel(team.season, team.seasonName)} focus={null} name={statsName} onreload={() => void loadStats()} onback={() => (statsOpen = false)} backText={LM.statsTeamClose} embedded />
    {:else}
      <button class="btn" onclick={openStats} disabled={statsOpen && statsStatus === 'loading'} data-act="team-profile-stats">{LM.statsTeamOpen}</button>
    {/if}
    <!-- T-11-290 스쿼드 댓글 — 프로필을 그린 뒤 따로 불러온다(보는 사람마다 달라 프로필 응답에 섞지 않는다). -->
    <TeamComments teamId={team.id} />
    {#if !mine}
      <NameReports>
        <NameReport kind="team" id={team.id} name={team.name} />
        {#if team.ownerNickname}<NameReport kind="owner" id={team.id} name={team.ownerNickname} />{/if}
      </NameReports>
    {/if}
    </div>
  {/if}
</LoadState>
<!-- T-10-130 '← 랭킹'은 화면 아래(탭바 위)로. 뒤로 가기로도 랭킹에 돌아간다. -->

<style>
  .tp-sections {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .tp-title {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }
  .tp-title h1 {
    overflow-wrap: anywhere;
  }
  .tp-identity {display:flex;align-items:center;gap:10px;min-width:0;}
  .tp-names {min-width:0;}
  .tp-people {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    width: 100%;
    min-height: 44px;
    padding: 6px 12px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface-2);
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .tp-people:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  @media (hover: hover) {
    .tp-people:hover {
      border-color: var(--accent);
    }
    .tp-people:hover .tp-people-go {
      color: var(--accent-text);
    }
  }
  .tp-people-text {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 10px;
    min-width: 0;
  }
  .tp-people-go {
    flex: none;
    white-space: nowrap;
  }
  .tp-manager {
    color: var(--ink);
  }
  .tp-rating {
    flex: none;
    display: grid;
    place-items: center;
    min-width: 76px;
    padding: 6px 10px;
    border-radius: 12px;
    background: var(--pitch);
    color: var(--on-pitch);
    line-height: 1.1;
  }
  .tp-rating small {
    font-family: var(--display);
    font-size: 0.6875rem;
    letter-spacing: 0.12em;
  }
  .tp-rating b {
    font-family: var(--display);
    font-size: 1.5rem;
    color: var(--pitch-accent);
  }
  .tp-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    margin: 0;
  }
  .tp-stats div {
    display: grid;
    place-items: center;
    padding: 6px 2px;
    border-radius: 10px;
    background: var(--surface-2);
    text-align: center;
  }
  .tp-stats dt {
    font-size: 0.75rem;
    color: var(--muted);
  }
  .tp-stats dd {
    margin: 0;
    font-weight: 700;
  }
  /* 시너지 표는 자체 안쪽 여백·밑줄을 가지는데(편성 카드용) 프로필 카드 안에서는 카드 여백을 쓴다. */
  .tp-coach {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .tp-syn :global(.syn) {
    padding: 0;
    border-bottom: 0;
  }
  .tp-social {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 14px;
  }
  .tp-like {
    min-height: 40px;
    padding: 0 14px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }
  .tp-like[aria-pressed='true'] span {
    color: var(--bad);
  }
  .tp-like:disabled {
    cursor: default;
    opacity: 0.7;
  }
  .tp-badges {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 8px;
  }
  .tp-badges li {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--surface-2);
  }
  .tp-badges li.final {
    box-shadow: inset 0 0 0 2px var(--pitch-accent);
  }
</style>
