<script lang="ts">
  // T-10-092 팀 프로필(라이브 랭킹에서 연다) — 시즌 순위 · 감독 · 레이팅 · 선발 그라운드 · 줄 힘 · 좋아요/조회수 · 팀 히스토리
  // 배지. 누구나 본다. 남의 팀을 열면 조회수를 한 번 올린다(내 팀은 세지 않는다).
  import { onMount } from 'svelte';
  import {
    fetchTeamProfile,
    likeTeam,
    viewTeam,
    type TeamProfile,
  } from '../../api/team.js';
  import { localCareerNames } from '../../game/season.js';
  import { toast } from '../helpers.js';
  import LoadState, { type LoadStatus } from '../LoadState.svelte';
  import BackBar from '../BackBar.svelte';
  import TeamLines from './TeamLines.svelte';
  import TeamPitch from './TeamPitch.svelte';
  import { num as n, recordText } from './teamText.js';

  let { id, onback }: { id: string; onback: () => void } = $props();

  let status = $state<LoadStatus>('loading');
  let team = $state<TeamProfile | null>(null);
  let liked = $state(false);
  let mine = $state(false);
  let liking = $state(false);

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

  const cells = $derived(
    team?.slots.map((s) => ({
      rating: s.rating,
      name: (mine && s.careerId && localNames.get(s.careerId)) || s.name,
      youth: s.careerId === null,
    })) ?? [],
  );
</script>

<LoadState {status} failText="팀을 불러오지 못했어요." retry={load}>
  {#if team}
    <section class="card stack tp-head" style="gap:10px" data-team-profile={team.id}>
      <div class="tp-top">
        <span class="eyebrow">Team profile{team.rank ? ` · #${team.rank}` : ''}</span>
      </div>
      <div class="tp-title">
        <div>
          <small class="muted">{team.seasonName}{team.rank ? ` · RANK #${team.rank}` : ''}</small>
          <h1>{team.name}</h1>
          <p class="muted fs-sm">감독 <b class="tp-manager">{team.manager}</b>{mine ? ' · 내 팀' : ''}</p>
        </div>
        <div class="tp-rating" aria-label="팀 레이팅 {team.rating}"><small>RATING</small><b>{n(team.rating)}</b></div>
      </div>
      <dl class="tp-stats">
        <div><dt>팀 OVR</dt><dd>{team.ovr}</dd></div>
        <div><dt>전적</dt><dd>{recordText(team.record)}</dd></div>
        <div><dt>득실</dt><dd>{team.goals.for} : {team.goals.against}</dd></div>
      </dl>
    </section>

    <TeamPitch formation={team.formation} {cells} />

    <section class="card stack" style="gap:12px">
      <TeamLines lines={team.lines} />
      <div class="tp-social">
        <button class="tp-like" aria-pressed={liked} disabled={mine || liking} onclick={toggleLike} data-act="team-like" aria-label="좋아요 {team.likes}">
          <span aria-hidden="true">{liked ? '♥' : '♡'}</span> {n(team.likes)}
        </button>
        <span class="muted">조회수 <b>{n(team.views)}</b></span>
        <span class="muted fs-xs tp-formation">{team.formation}</span>
      </div>
    </section>

    <section class="card stack" style="gap:10px" data-team-history>
      <div>
        <div class="eyebrow">Team history</div>
        <h2>팀 히스토리</h2>
      </div>
      {#if team.badges.length}
        <ul class="tp-badges">
          {#each team.badges as b (b.id)}
            <li data-badge={b.id} class:final={b.id.startsWith('final-')}><b>{b.label}</b><small class="muted">{b.desc}</small></li>
          {/each}
        </ul>
      {:else}
        <p class="empty">첫 기록을 기다리고 있어요. 팀 경기와 시즌 순위의 배지가 이곳에 쌓여요.</p>
      {/if}
    </section>
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
