<script lang="ts">
  // 경기 결과(중계가 끝난 뒤) — 스코어 · 득점 · 레이팅 변화. T-11-098 친선전은 레이팅·전적 없이 '친선전'만 단다.
  import type { OwnerTeam, TeamMatch } from '@offside/app-core/api/team';
  import { kstMonthDayTime } from '@offside/app-core/boardText';
  import { OUTCOME_TITLE, outcomeOf as outcome } from '@offside/app-core/teamOwner';
  import { teamMatchText as L } from '@offside/app-core/i18n/ko/teamMatch';
  import { recordText, signedNum } from '@offside/app-core/teamText';
  import TeamLogo from './TeamLogo.svelte';
  import TeamReport from './TeamReport.svelte';
  import { teamMomentsText as M } from '@offside/app-core/i18n/ko/teamMoments';
  import { momentTitle, pickedLabel } from '@offside/app-core/teamMoments';
  import type { ReportLine } from '@offside/contracts/owner-team';

  let {
    m,
    team,
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
            {#if e.slot}<small class="muted tm-slot">{e.slot}</small>{/if}
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
  <TeamReport {m} {fix} />
  <p class="muted fs-sm">{kstMonthDayTime(m.createdAt)}{team && m.mine === 'home' && !m.friendly ? L.resultRecord({ record: recordText(team.record) }) : ''}</p>
  {#if gain != null}
    <p class="fs-sm" data-rating-change>{L.ratingChange}<b>{signedNum(gain)}</b></p>
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
  .tm-slot {
    font-size: 0.75rem;
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
    border-radius: 10px;
    background: var(--surface-2);
    box-shadow: inset 3px 0 0 var(--pitch-2);
    font-size: 0.875rem;
  }
  .tm-moments li.fail {
    box-shadow: inset 3px 0 0 var(--line);
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
</style>
