<script lang="ts">
  // 최근 경기 — 이 시즌에 치른 경기 목록. 누르면 그 경기의 결과를 연다.
  import type { TeamMatch } from '@offside/app-core/api/team';
  import { kstMonthDayTime } from '@offside/app-core/boardText';
  import { outcomeOf as outcome } from '@offside/app-core/teamOwner';
  import LoadState, { type LoadStatus } from '../LoadState.svelte';
  import TeamLogo from './TeamLogo.svelte';

  let {
    history,
    status,
    onreload,
    onopen,
  }: {
    history: TeamMatch[];
    status: LoadStatus;
    onreload: () => void;
    onopen: (m: TeamMatch) => void;
  } = $props();
</script>

<section class="card stack" style="gap:12px">
  <div>
    <div class="eyebrow">Matches</div>
    <h1>최근 경기</h1>
  </div>
  <LoadState {status} failText="경기 기록을 불러오지 못했어요." retry={onreload}>
    {#each history as m (m.id)}
      {@const opp = m[m.mine === 'home' ? 'away' : 'home']}
      <button class="tm-hist" onclick={() => onopen(m)} data-team-match={m.id}>
        <span class="tm-out" data-out={outcome(m)}>{outcome(m)}</span>
        <TeamLogo logo={opp.logo} name={opp.name} size={28} decorative />
        <span class="tm-opp-info">
          <b>{m[m.mine].goals} : {opp.goals} {opp.name}</b>
          <span class="muted fs-sm">{m.mine === 'home' ? '도전' : '도전받음'} · {opp.owner} · {kstMonthDayTime(m.createdAt)}</span>
        </span>
      </button>
    {:else}
      <p class="muted">아직 치른 경기가 없어요.</p>
    {/each}
  </LoadState>
</section>

<style>
  .tm-hist {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 0;
    border-top: 1px solid var(--line);
    width: 100%;
    background: none;
    border-inline: 0;
    border-bottom: 0;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
    min-height: 52px;
  }
  .tm-opp-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .tm-out {
    flex: none;
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 10px;
    font-weight: 700;
    background: var(--surface-2);
  }
  .tm-out[data-out='승'] {
    color: var(--good);
  }
  .tm-out[data-out='패'] {
    color: var(--bad);
  }
</style>
