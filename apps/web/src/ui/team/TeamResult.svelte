<script lang="ts">
  // 경기 결과(중계가 끝난 뒤) — 스코어 · 득점 · 레이팅 변화. T-11-098 친선전은 레이팅·전적 없이 '친선전'만 단다.
  // T-11-498 위 띠에 승패 · 스코어 · 팀별 득점자를 모으고, 레이팅 · 전적은 그 아래 칩으로, 다시 경기하기 하나만 크게 둔다.
  import type { OwnerTeam, TeamMatch } from '@offside/app-core/api/team';
  import { kstMonthDayTime } from '@offside/app-core/boardText';
  import { OUTCOME_TITLE, outcomeOf as outcome } from '@offside/app-core/teamOwner';
  import { teamMatchText as L } from '@offside/app-core/i18n/ko/teamMatch';
  import { recordText, signedNum } from '@offside/app-core/teamText';
  import TeamLogo from './TeamLogo.svelte';
  import DivisionEmblem from './DivisionEmblem.svelte';
  import { divisionShiftView, type DivisionShift } from '@offside/app-core/teamDivision';
  import TeamReport from './TeamReport.svelte';
  import { teamMomentsText as M } from '@offside/app-core/i18n/ko/teamMoments';
  import { momentTitle, pickedLabel } from '@offside/app-core/teamMoments';
  import { usesRankLadder, type ReportLine } from '@offside/contracts/owner-team';

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
    fix,
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
    /** T-11-379 리포트 '고칠 곳' — 내 편성을 고칠 수 있을 때만 준다(다른 팀 경기 · 지난 시즌에는 없다). */
    fix?: ((line: ReportLine) => { pos: string; go: () => void } | null) | undefined;
  } = $props();
  const link = (id: string | null) => (onplayer && !m.friendly && id ? id : null);

  const gain = $derived(m[m.mine].ratingChange);
  const moved = $derived(m.friendly ? null : divisionShiftView(shift));
  const won = $derived(outcome(m) === '승'); // i18n-ignore 결과 키
  const record = $derived(team && m.mine === 'home' && !m.friendly ? recordText(team.record) : null);
  const goalsOf = (side: 'home' | 'away') => m.events.filter((e) => e.side === side);
</script>

{#snippet scorers(side: 'home' | 'away')}
  <ol class="tm-scorers" class:away={side === 'away'}>
    {#each goalsOf(side) as e, k (k)}
      <li>
        <span>
          {#if link(e.scorerId)}
            <button class="tm-player" onclick={() => onplayer!(e.scorerId!)} aria-label={L.playerStatsAria({ name: eventName(e.scorerId, e.scorer) })} data-act="team-player-stats"><b>{eventName(e.scorerId, e.scorer)}</b></button>
          {:else}<b>{eventName(e.scorerId, e.scorer)}</b>{/if}
          {#if e.slot}<small class="tm-slot">{e.slot}</small>{/if}
          <span class="tm-min">{e.minute}'</span>
        </span>
        {#if e.assist}
          {#if link(e.assistId)}
            <button class="tm-player tm-assist" onclick={() => onplayer!(e.assistId!)} aria-label={L.playerStatsAria({ name: eventName(e.assistId, e.assist) })}>{L.assist({ name: eventName(e.assistId, e.assist) })}</button>
          {:else}<small class="tm-assist">{L.assist({ name: eventName(e.assistId, e.assist) })}</small>{/if}
        {/if}
      </li>
    {/each}
  </ol>
{/snippet}

<section class="card stack tm-result" style="gap:14px" data-team-result>
  <div class="tm-band">
    <div class="tm-band-top">
      <span class="eyebrow">Full time{#if m.friendly}&nbsp;· <span data-friendly>{L.kindFriendly}</span>{/if}</span>
      <span class="fs-xs">{kstMonthDayTime(m.createdAt)}</span>
    </div>
    <div class="tm-score">
      <div class="tm-side" class:mine={m.mine === 'home'}>
        <TeamLogo logo={m.home.logo} name={m.home.name} size={52} decorative />
        <b>{m.home.name}</b><small>{m.home.owner}</small><small>OVR {m.home.ovr}</small>
      </div>
      <div class="tm-center">
        <h1 class:won>{OUTCOME_TITLE[outcome(m)]}</h1>
        <div class="tm-goals">
          <b class:mine={m.mine === 'home'}>{m.home.goals}</b><span aria-hidden="true">:</span><b class:mine={m.mine === 'away'}>{m.away.goals}</b>
        </div>
      </div>
      <div class="tm-side" class:mine={m.mine === 'away'}>
        <TeamLogo logo={m.away.logo} name={m.away.name} size={52} decorative />
        <b>{m.away.name}</b><small>{m.away.owner}</small><small>OVR {m.away.ovr}</small>
      </div>
    </div>
    {#if m.events.length}
      <div class="tm-events">
        {@render scorers('home')}
        {@render scorers('away')}
      </div>
    {:else}
      <p class="tm-none fs-sm">{L.noGoals}</p>
    {/if}
  </div>
  {#if m.friendly}
    <p class="tm-chips"><span class="tm-chip muted">{L.friendlyNote}</span></p>
  {:else if gain != null || record}
    <p class="tm-chips">
      {#if gain != null}<span class="tm-chip gain" data-rating-change>{usesRankLadder(team?.season ?? 0) ? L.ratingChangeRp : L.ratingChange}<b>{signedNum(gain)}</b></span>{/if}
      {#if record}<span class="tm-chip">{L.recordChip({ record })}</span>{/if}
    </p>
  {/if}
  {#if m.moments?.length}
    <div class="tm-moments" data-team-moments>
      <h2 class="eyebrow">{M.recordTitle}</h2>
      <ul>
        {#each m.moments as x (x.index)}
          <li class:fail={!x.ok}>
            <b>{momentTitle(x)}</b>
            <span>{M.recordLine({ minute: x.minute, name: `${eventName(x.actor.id, x.actor.name)}(${x.actor.slot})`, choice: pickedLabel(x, eventName), ok: !!x.ok })}</span>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
  {#if moved}
    <div class="tm-div-shift" class:up={moved.up} role="status" data-division-shift={moved.up ? 'up' : 'down'}>
      <span class="tm-div-shift-emblem"><DivisionEmblem division={moved.division} size={44} /></span>
      <div><b>{moved.title}</b><small class="muted">{moved.body}</small></div>
    </div>
  {/if}
  <TeamReport {m} {fix} />
  <div class="tm-actions">
    <button class="btn btn-primary tm-again" onclick={onagain} disabled={matchesLeft === 0}>
      <span>{L.again}</span>
      {#if !m.friendly}<small>{matchesLeft > 0 ? L.againLeft({ n: matchesLeft }) : L.againNone}</small>{/if}
    </button>
    <div class="tm-actions-sub">
      <button class="btn" onclick={onreplay} data-act="team-replay">{L.replay}</button>
      {#if onhistory}<button class="btn" onclick={onhistory} data-act="team-result-history">{L.backHistory}</button>{:else}<button class="btn" onclick={ontoTeam}>{L.toLineup}</button>{/if}
    </div>
  </div>
</section>

<style>
  .tm-band {
    padding: 18px 14px 16px;
    border-radius: var(--radius-md);
    background: var(--pitch);
    color: var(--on-pitch);
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .tm-band-top {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }
  .tm-band .eyebrow,
  .tm-band small,
  .tm-band .tm-min,
  .tm-band .tm-assist,
  .tm-none {
    color: color-mix(in srgb, var(--on-pitch) 72%, transparent);
  }
  .tm-score {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: center;
    gap: 8px;
  }
  .tm-side {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 0;
    text-align: center;
    overflow-wrap: anywhere;
  }
  .tm-side :global(.team-logo) {
    margin-bottom: 4px;
  }
  .tm-side small {
    font-size: var(--fs-caption);
  }
  .tm-side.mine b {
    color: var(--pitch-accent);
  }
  .tm-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  .tm-center h1 {
    margin: 0;
    font-family: var(--display);
    font-size: var(--fs-title2);
    letter-spacing: 0.04em;
  }
  .tm-center h1.won {
    color: var(--pitch-accent);
  }
  .tm-goals {
    display: flex;
    gap: 10px;
    font-family: var(--display);
    font-size: 3.5rem;
    font-weight: 700;
    line-height: 1;
  }
  .tm-goals span {
    opacity: 0.6;
  }
  .tm-goals b.mine {
    color: var(--pitch-accent);
  }
  .tm-events {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--chalk);
  }
  .tm-scorers {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: var(--fs-body2);
    min-width: 0;
  }
  .tm-scorers.away {
    text-align: right;
  }
  .tm-scorers li {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .tm-scorers li > span {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    column-gap: 5px;
  }
  .tm-scorers.away li > span {
    justify-content: flex-end;
  }
  .tm-scorers.away li {
    align-items: flex-end;
  }
  .tm-slot,
  .tm-assist {
    font-size: var(--fs-caption);
  }
  .tm-min {
    font-family: var(--display);
    font-weight: 700;
  }
  .tm-none {
    margin: 0;
    text-align: center;
  }
  .tm-chips {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .tm-chip {
    display: inline-flex;
    align-items: center;
    min-height: 28px;
    padding: 0 10px;
    border-radius: var(--radius-pill);
    border: 1px solid var(--line);
    background: var(--surface-2);
    font-size: var(--fs-label);
  }
  .tm-chip.gain {
    border-color: var(--accent);
    color: var(--accent-text);
  }
  .tm-chip.gain b {
    margin-left: 2px;
  }
  .tm-moments ul {
    list-style: none;
    margin: 6px 0 0;
    padding: 0;
    display: grid;
    gap: 6px;
  }
  .tm-moments li {
    display: grid;
    gap: 2px;
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    box-shadow: inset 3px 0 0 var(--pitch-2);
    font-size: var(--fs-body2);
  }
  .tm-moments li.fail {
    box-shadow: inset 3px 0 0 var(--line);
  }
  .tm-actions {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .tm-again {
    min-height: 56px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
  }
  .tm-again small {
    font-size: var(--fs-caption);
    font-weight: 500;
  }
  .tm-actions-sub {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }
  .tm-actions-sub .btn {
    background: transparent;
    border-color: transparent;
  }
  .tm-player {
    all: unset;
    cursor: pointer;
    text-decoration: underline;
    text-decoration-color: var(--chalk);
    text-underline-offset: 3px;
  }
  .tm-player:focus-visible {
    outline: 2px solid var(--pitch-accent);
    outline-offset: 2px;
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
