<script lang="ts">
  // T-11-603 매칭 완료 화면의 스쿼드 · 선발 명단: 상대 · 내 팀을 골라 그라운드 · 명단 · 감독 · 줄 힘을 본다. 상대는 매칭되면 바로, 내 팀은 탭을 누를 때 불러온다.
  import { untrack } from 'svelte';
  import { presetLayout, shapeOf } from '@offside/contracts/owner-team';
  import { fetchTeamScout, type TeamProfile } from '@offside/app-core/api/team';
  import { teamMatchText as L } from '@offside/app-core/i18n/ko/teamMatch';
  import { managerText as MG } from '@offside/app-core/i18n/ko/manager';
  import { coachLineBonus, coachSummary } from '@offside/app-core/managerCard';
  import { localCareerNames } from '@offside/game/hof-store';
  import LoadState, { type LoadStatus } from '../LoadState.svelte';
  import TeamLines from './TeamLines.svelte';
  import TeamPitch from './TeamPitch.svelte';

  let { opponentId, myId }: { opponentId: string; myId: string } = $props();

  let side = $state<'opp' | 'me'>('opp');
  const id = $derived(side === 'opp' ? opponentId : myId);
  let status = $state<LoadStatus>('loading');
  let team = $state<TeamProfile | null>(null);
  const localNames = localCareerNames();

  async function load(want: string) {
    status = 'loading';
    const r = await fetchTeamScout(want);
    if (want !== id) return;
    if (!r.ok) {
      status = 'error';
      return;
    }
    team = r.data.team;
    status = 'ready';
  }
  $effect(() => {
    const want = id;
    untrack(() => void load(want));
  });

  const nameOf = (s: TeamProfile['slots'][number]) =>
    (side === 'me' && s.careerId && localNames.get(s.careerId)) || s.name;
  const players = $derived(new Map(team?.players?.map((p) => [p.careerId, p]) ?? []));
  const cells = $derived(
    team?.slots.map((s) => ({
      rating: s.rating,
      nation: s.nation,
      season: s.season,
      name: nameOf(s),
      youth: s.careerId === null,
      player: s.careerId ? players.get(s.careerId) : undefined,
    })) ?? [],
  );
  const positions = $derived(team ? (team.layout ?? presetLayout(team.formation)) : []);
  const coachBonus = $derived(
    team?.coach ? coachLineBonus(team.coach, team.formation, team.synergy ?? null, team.season) : null,
  );
</script>

<div class="rs stack" data-rank-squad>
  <div class="seg two" role="group" aria-label={L.squadSideAria}>
    <button class="hof-sort" aria-pressed={side === 'opp'} data-squad-side="opp" onclick={() => (side = 'opp')}>{L.squadOpponent}</button>
    <button class="hof-sort" aria-pressed={side === 'me'} data-squad-side="me" onclick={() => (side = 'me')}>{L.queueMe}</button>
  </div>
  <LoadState {status} failText={L.squadLoadFail} retry={() => void load(id)}>
    {#if team}
      <p class="muted fs-sm rs-line" data-squad-team={team.id}><b>{team.name}</b> · {shapeOf(team.formation, team.layout)} · {L.oppOvr({ n: team.ovr })}</p>
      <TeamPitch formation={team.formation} layout={team.layout} {cells} />
      <h2 class="rs-title">{L.squadLineup}</h2>
      <ol class="rs-list" data-squad-lineup>
        {#each team.slots as s, i (i)}
          <li class:youth={s.careerId === null}>
            <span class="rs-slot">{positions[i]?.slot ?? s.slot}</span>
            <span class="rs-name">{nameOf(s)}</span>
            <b class="rs-rating">{s.rating}</b>
          </li>
        {/each}
      </ol>
      {#if team.coach}
        <div class="rs-coach" data-squad-coach>
          <b>{MG.profileCoach}</b>
          <span class="muted fs-sm">{coachSummary(team.coach, team.formation, localNames)}</span>
        </div>
      {/if}
      <TeamLines lines={team.lines} coach={coachBonus} />
    {/if}
  </LoadState>
</div>

<style>
  .rs {width: 100%; gap: 10px; text-align: left;}
  /* 카드 안쪽 여백(20px)까지 넓혀 팀 프로필과 같은 폭으로 그린다. 좁으면 선수 카드가 더 겹친다. */
  .rs :global([data-pitch-frame]) {width: calc(100% + 40px); max-width: none; margin-inline: -20px;}
  .rs-line {margin: 0;}
  .rs-title {margin: 4px 0 0; font-size: var(--fs-body2); font-weight: 700;}
  .rs-list {margin: 0; padding: 0; list-style: none; display: grid;}
  .rs-list li {display: flex; align-items: center; gap: 10px; padding: 7px 0; border-top: 1px solid var(--line);}
  .rs-list li.youth {color: var(--muted);}
  .rs-slot {flex: none; width: 3em; font-size: var(--fs-caption); font-weight: 700; color: var(--muted);}
  .rs-name {flex: 1; min-width: 0; overflow-wrap: anywhere;}
  .rs-rating {flex: none; font-variant-numeric: tabular-nums;}
  .rs-coach {display: grid; gap: 2px;}
</style>
