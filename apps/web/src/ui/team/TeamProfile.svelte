<script lang="ts">
  import { seasonLabel } from '@offside/app-core/seasonName';
  // T-10-092 팀 프로필(라이브 랭킹에서 연다) — 시즌 순위 · 감독 · 레이팅 · 선발 그라운드 · 줄 힘 · 좋아요/조회수 · 팀 히스토리
  // 배지. 누구나 본다. 남의 팀을 열면 조회수를 한 번 올린다(내 팀은 세지 않는다).
  import { onMount } from 'svelte';
  import {
    fetchTeamProfile,
    likeTeam,
    viewTeam,
    type TeamProfile,
  } from '@offside/app-core/api/team';
  import { requestFriend, type FriendState } from '@offside/app-core/api/friends';
  import { teamSeasonClosed } from '@offside/contracts/service-seasons';
  import { localCareerNames } from '@offside/game/season';
  import { toast } from '../helpers.js';
  import LoadState, { type LoadStatus } from '../LoadState.svelte';
  import BackBar from '../BackBar.svelte';
  import NameReport from '../NameReport.svelte';
  import TeamLines from './TeamLines.svelte';
  import TeamPitch from './TeamPitch.svelte';
  import TeamLogo from './TeamLogo.svelte';
  import { num as n, recordText } from '@offside/app-core/teamText';
  import { friendRequestText } from '@offside/app-core/friendText';
  import { friendText as LF } from '@offside/app-core/i18n/ko/friend';
  import { teamAchText as L } from '@offside/app-core/i18n/ko/teamAch';

  let { id, onback }: { id: string; onback: () => void } = $props();

  let status = $state<LoadStatus>('loading');
  let team = $state<TeamProfile | null>(null);
  let liked = $state(false);
  let mine = $state(false);
  let liking = $state(false);
  /** T-11-098 나와 이 팀 구단주의 친구 상태(로그인한 구단주가 남의 팀을 볼 때만 온다). */
  let friend = $state<FriendState | null>(null);
  let befriending = $state(false);
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

  const cells = $derived(
    team?.slots.map((s) => ({
      rating: s.rating,
      nation: s.nation,
      name: (mine && s.careerId && localNames.get(s.careerId)) || s.name,
      youth: s.careerId === null,
    })) ?? [],
  );
</script>

<LoadState {status} failText={L.profLoadFail} retry={load}>
  {#if team}
    <section class="card stack tp-head" style="gap:10px" data-team-profile={team.id}>
      <div class="tp-top">
        <span class="eyebrow">Team profile{team.rank ? ` · #${team.rank}` : ''}</span>
      </div>
      <div class="tp-title">
        <div class="tp-identity"><TeamLogo logo={team.logo} name={team.name} size={56} /><div class="tp-names">
          <small class="muted">{seasonLabel(team.season, team.seasonName)}{team.rank ? ` · RANK #${team.rank}` : ''}</small>
          <h1>{team.name}</h1>
          <p class="muted fs-sm">{L.profManager}<b class="tp-manager">{team.manager}</b>{mine ? L.profMine : ''}</p>
        </div></div>
        <div class="tp-rating" aria-label={L.profRatingAria({ n: team.rating })}><small>RATING</small><b>{n(team.rating)}</b></div>
      </div>
      <dl class="tp-stats">
        <div><dt>{L.profStatOvr}</dt><dd>{team.ovr}</dd></div>
        <div><dt>{L.profStatRecord}</dt><dd>{recordText(team.record)}</dd></div>
        <div><dt>{L.profStatGoals}</dt><dd>{team.goals.for} : {team.goals.against}</dd></div>
      </dl>
    </section>

    <TeamPitch formation={team.formation} layout={team.layout} {cells} />

    <section class="card stack" style="gap:12px">
      <TeamLines lines={team.lines} />
      <div class="tp-social">
        <button class="tp-like" aria-pressed={liked} disabled={mine || liking || closed} onclick={toggleLike} data-act="team-like" aria-label={L.profLikeAria({ n: team.likes })}>
          <span aria-hidden="true">{liked ? '♥' : '♡'}</span> {n(team.likes)}
        </button>
        <span class="muted">{L.profViews}<b>{n(team.views)}</b></span>
        {#if friend}<button class="btn btn-sm" class:btn-primary={friend === 'none' || friend === 'received'} disabled={befriending || friend === 'sent' || friend === 'accepted'} onclick={befriend} data-act="team-friend" data-friend-state={friend}>{friendButton(friend)}</button>{/if}
        <span class="muted fs-xs tp-formation">{team.formation}</span>
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
    {#if !mine}<NameReport kind="team" id={team.id} name={team.name} />{/if}
  {/if}
</LoadState>
<!-- T-10-130 '← 랭킹'은 화면 아래(탭바 위)로. 뒤로 가기로도 랭킹에 돌아간다. -->
<BackBar act="team-profile-back" fallback={onback} atBottom={false} />

<style>
  .tp-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
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
  .tp-social {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 14px;
  }
  .tp-formation {
    margin-left: auto;
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
