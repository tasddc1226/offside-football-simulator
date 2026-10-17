<script lang="ts">
  // 경기 결과(중계가 끝난 뒤) — 스코어 · 득점 · 레이팅 변화. T-11-098 친선전은 레이팅·전적 없이 '친선전'만 단다.
  import type { OwnerTeam, TeamMatch } from '@offside/app-core/api/team';
  import { kstMonthDayTime } from '@offside/app-core/boardText';
  import { OUTCOME_TITLE, outcomeOf as outcome } from '@offside/app-core/teamOwner';
  import { teamMatchText as L } from '@offside/app-core/i18n/ko/teamMatch';
  import { recordText, signedNum } from '@offside/app-core/teamText';
  import TeamLogo from './TeamLogo.svelte';
  import DivisionEmblem from './DivisionEmblem.svelte';
  import { divisionShiftView, type DivisionShift } from '@offside/app-core/teamDivision';

  let {
    m,
    team,
    shift = null,
    eventName,
    matchesLeft,
    ontoTeam,
    onreplay,
    onagain,
    onhistory,
    onplayer,
  }: {
    m: TeamMatch;
    team: OwnerTeam | null;
    /** T-11-375 방금 치른 경기의 내 디비전 전후(기록에서 연 경기는 null). */
    shift?: DivisionShift | null;
    eventName: (id: string | null, fallback: string) => string;
    matchesLeft: number;
    ontoTeam: () => void;
    onreplay: () => void;
    onagain: () => void;
    onhistory?: (() => void) | undefined;
    /** T-11-269 우리 선수 이름을 누르면 시즌 통계의 그 선수 줄로(랭크 경기만 — 친선전은 통계에 없다). */
    onplayer?: ((careerId: string) => void) | undefined;
  } = $props();
  const link = (id: string | null) => (onplayer && !m.friendly && id ? id : null);

  const gain = $derived(m[m.mine].ratingChange);
  const moved = $derived(m.friendly ? null : divisionShiftView(shift));
</script>

<section class="card stack tm-result" style="gap:14px" data-team-result>
  <div>
    <div class="eyebrow">Full time{#if m.friendly}&nbsp;· <span data-friendly>{L.kindFriendly}</span>{/if}</div>
    <h1>{OUTCOME_TITLE[outcome(m)]}</h1>
  </div>
  <div class="tm-score">
    <div class="tm-side" class:mine={m.mine === 'home'}>
      <TeamLogo logo={m.home.logo} name={m.home.name} size={40} decorative />
      <b>{m.home.name}</b><small class="muted">{m.home.owner} · OVR {m.home.ovr}</small>
    </div>
    <div class="tm-goals"><b>{m.home.goals}</b><span aria-hidden="true">:</span><b>{m.away.goals}</b></div>
    <div class="tm-side away" class:mine={m.mine === 'away'}>
      <TeamLogo logo={m.away.logo} name={m.away.name} size={40} decorative />
      <b>{m.away.name}</b><small class="muted">{m.away.owner} · OVR {m.away.ovr}</small>
    </div>
  </div>
  {#if m.events.length}
    <ol class="tm-events">
      {#each m.events as e, k (k)}
        <li class:away={e.side === 'away'}>
          <span class="tm-min">{e.minute}'</span>
          <span>
            {#if link(e.scorerId)}
              <button class="tm-player" onclick={() => onplayer!(e.scorerId!)} aria-label={L.playerStatsAria({ name: eventName(e.scorerId, e.scorer) })} data-act="team-player-stats"><b>{eventName(e.scorerId, e.scorer)}</b></button>
            {:else}<b>{eventName(e.scorerId, e.scorer)}</b>{/if}
            {#if e.assist}
              {#if link(e.assistId)}
                <button class="tm-player muted fs-sm" onclick={() => onplayer!(e.assistId!)} aria-label={L.playerStatsAria({ name: eventName(e.assistId, e.assist) })}>{L.assist({ name: eventName(e.assistId, e.assist) })}</button>
              {:else}<small class="muted">{L.assist({ name: eventName(e.assistId, e.assist) })}</small>{/if}
            {/if}
          </span>
        </li>
      {/each}
    </ol>
  {:else}
    <p class="muted">{L.noGoals}</p>
  {/if}
  <p class="muted fs-sm">{kstMonthDayTime(m.createdAt)}{team && m.mine === 'home' && !m.friendly ? L.resultRecord({ record: recordText(team.record) }) : ''}</p>
  {#if gain != null}
    <p class="fs-sm" data-rating-change>{L.ratingChange}<b>{signedNum(gain)}</b></p>
  {/if}
  {#if moved}
    <div class="tm-div-shift" class:up={moved.up} role="status" data-division-shift={moved.up ? 'up' : 'down'}>
      <span class="tm-div-shift-emblem"><DivisionEmblem division={moved.division} size={44} /></span>
      <div><b>{moved.title}</b><small class="muted">{moved.body}</small></div>
    </div>
  {/if}
  <div class="tm-actions">
    {#if onhistory}<button class="btn" onclick={onhistory} data-act="team-result-history">{L.backHistory}</button>{:else}<button class="btn" onclick={ontoTeam}>{L.toLineup}</button>{/if}
    <button class="btn" onclick={onreplay} data-act="team-replay">{L.replay}</button>
    <button class="btn btn-primary" onclick={onagain} disabled={matchesLeft === 0}>{L.again}</button>
  </div>
</section>

<style>
  .tm-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .tm-score {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 10px;
  }
  .tm-side {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .tm-side.away {
    text-align: right;
    align-items: flex-end;
  }
  .tm-side.mine b {
    color: var(--accent-text);
  }
  .tm-goals {
    display: flex;
    gap: 8px;
    font-family: var(--display);
    font-size: 2.5rem;
    font-weight: 700;
    line-height: 1;
  }
  .tm-events {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .tm-events li {
    display: flex;
    gap: 10px;
    align-items: baseline;
  }
  .tm-events li.away {
    flex-direction: row-reverse;
    text-align: right;
  }
  .tm-events li > span:last-child {
    display: flex;
    flex-direction: column;
  }
  .tm-player {
    all: unset;
    cursor: pointer;
    text-decoration: underline;
    text-decoration-color: var(--line);
    text-underline-offset: 3px;
  }
  .tm-player:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .tm-min {
    flex: none;
    font-family: var(--display);
    font-weight: 700;
    color: var(--muted);
    min-width: 2.2em;
  }
  .tm-div-shift {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 14px;
    border: 1px solid var(--line);
    background: color-mix(in srgb, var(--bad) 8%, var(--surface));
  }
  .tm-div-shift.up {
    border-color: color-mix(in srgb, var(--accent) 50%, var(--line));
    background: color-mix(in srgb, var(--accent) 14%, var(--surface));
  }
  .tm-div-shift div {
    display: grid;
    gap: 2px;
  }
  .tm-div-shift b {
    font-size: 17px;
  }
  .tm-div-shift.up .tm-div-shift-emblem {
    animation: tm-div-pop 0.6s cubic-bezier(0.2, 1.4, 0.4, 1) both;
  }
  @keyframes tm-div-pop {
    from {
      transform: scale(0.4) rotate(-12deg);
      opacity: 0;
    }
    to {
      transform: none;
      opacity: 1;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .tm-div-shift.up .tm-div-shift-emblem {
      animation: none;
    }
  }
</style>
