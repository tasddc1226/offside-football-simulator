<script lang="ts">
  // 경기 한 줄(최근 경기 · 최근 친선전). 누르면 그 경기의 결과를 연다.
  import type { TeamMatch } from '@offside/app-core/api/team';
  import { kstMonthDayTime } from '@offside/app-core/boardText';
  import { outcomeOf as outcome } from '@offside/app-core/teamOwner';
  import TeamLogo from './TeamLogo.svelte';

  let { m, onopen }: { m: TeamMatch; onopen: (m: TeamMatch) => void } = $props();
  const opp = $derived(m[m.mine === 'home' ? 'away' : 'home']);
  const kind = $derived(m.friendly ? '친선전' : m.mine === 'home' ? '도전' : '도전받음');
</script>

<button
  class="tm-hist"
  onclick={() => onopen(m)}
  data-team-match={m.friendly ? undefined : m.id}
  data-friendly-match={m.friendly ? m.id : undefined}
>
  <span class="tm-out" data-out={outcome(m)}>{outcome(m)}</span>
  <TeamLogo logo={opp.logo} name={opp.name} size={28} decorative />
  <span class="tm-opp-info">
    <b>{m[m.mine].goals} : {opp.goals} {opp.name}</b>
    <span class="muted fs-sm">{kind} · {opp.owner} · {kstMonthDayTime(m.createdAt)}</span>
  </span>
</button>

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
