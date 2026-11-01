<script lang="ts">
  // 경기 한 줄(최근 경기 · 최근 친선전 · T-11-603 랭크 매칭의 최근 전적). 누르면 그 경기의 결과를 연다. showRp면 그 경기의 RP 변화를 오른쪽에 보인다.
  import type { TeamMatch } from '@offside/app-core/api/team';
  import { kstMonthDayTime } from '@offside/app-core/boardText';
  import { outcomeLabel, outcomeOf as outcome } from '@offside/app-core/teamOwner';
  import { teamMatchText as L } from '@offside/app-core/i18n/ko/teamMatch';
  import { signedNum } from '@offside/app-core/teamText';
  import TeamLogo from './TeamLogo.svelte';

  let { m, onopen, showRp = false }: { m: TeamMatch; onopen: (m: TeamMatch) => void; showRp?: boolean } = $props();
  const opp = $derived(m[m.mine === 'home' ? 'away' : 'home']);
  const rp = $derived(showRp ? m[m.mine].ratingChange : null);
  const kind = $derived(m.friendly ? L.kindFriendly : m.mine === 'home' ? L.kindChallenge : L.kindChallenged);
</script>

<button
  class="tm-hist"
  onclick={() => onopen(m)}
  data-team-match={m.friendly ? undefined : m.id}
  data-friendly-match={m.friendly ? m.id : undefined}
>
  <span class="tm-out" data-out={outcome(m)}>{outcomeLabel(outcome(m))}</span>
  <TeamLogo logo={opp.logo} name={opp.name} size={28} decorative />
  <span class="tm-opp-info">
    <b>{m[m.mine].goals} : {opp.goals} {opp.name}</b>
    <span class="muted fs-sm">{kind} · {opp.owner} · {kstMonthDayTime(m.createdAt)}</span>
  </span>
  {#if rp !== null && rp !== undefined}<b class="tm-rp" class:down={rp < 0} data-match-rp={rp}>{signedNum(rp)}<small> {L.oppRp}</small></b>{/if}
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
  .tm-rp {
    flex: none;
    color: var(--good);
    font-variant-numeric: tabular-nums;
  }
  .tm-rp.down {
    color: var(--bad);
  }
  .tm-rp small {
    margin-inline-start: 2px;
    font-size: var(--fs-caption2);
    font-weight: 400;
  }
  .tm-out {
    flex: none;
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm);
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
