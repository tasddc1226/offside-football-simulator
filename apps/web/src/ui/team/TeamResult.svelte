<script lang="ts">
  // 경기 결과(중계가 끝난 뒤) — 스코어 · 득점 · 레이팅 변화.
  import type { OwnerTeam, TeamMatch } from '@offside/app-core/api/team';
  import { kstMonthDayTime } from '@offside/app-core/boardText';
  import { OUTCOME_TITLE, outcomeOf as outcome } from '@offside/app-core/teamOwner';
  import { recordText, signedNum } from '@offside/app-core/teamText';

  let {
    m,
    team,
    eventName,
    matchesLeft,
    ontoTeam,
    onreplay,
    onagain,
    onhistory,
  }: {
    m: TeamMatch;
    team: OwnerTeam | null;
    eventName: (id: string | null, fallback: string) => string;
    matchesLeft: number;
    ontoTeam: () => void;
    onreplay: () => void;
    onagain: () => void;
    onhistory?: (() => void) | undefined;
  } = $props();

  const gain = $derived(m[m.mine].ratingChange);
</script>

<section class="card stack tm-result" style="gap:14px" data-team-result>
  <div>
    <div class="eyebrow">Full time</div>
    <h1>{OUTCOME_TITLE[outcome(m)]}</h1>
  </div>
  <div class="tm-score">
    <div class="tm-side" class:mine={m.mine === 'home'}>
      <b>{m.home.name}</b><small class="muted">{m.home.owner} · OVR {m.home.ovr}</small>
    </div>
    <div class="tm-goals"><b>{m.home.goals}</b><span aria-hidden="true">:</span><b>{m.away.goals}</b></div>
    <div class="tm-side away" class:mine={m.mine === 'away'}>
      <b>{m.away.name}</b><small class="muted">{m.away.owner} · OVR {m.away.ovr}</small>
    </div>
  </div>
  {#if m.events.length}
    <ol class="tm-events">
      {#each m.events as e, k (k)}
        <li class:away={e.side === 'away'}>
          <span class="tm-min">{e.minute}'</span>
          <span>
            <b>{eventName(e.scorerId, e.scorer)}</b>
            {#if e.assist}<small class="muted">도움 {eventName(e.assistId, e.assist)}</small>{/if}
          </span>
        </li>
      {/each}
    </ol>
  {:else}
    <p class="muted">골 없이 비겼어요.</p>
  {/if}
  <p class="muted fs-sm">{kstMonthDayTime(m.createdAt)}{team && m.mine === 'home' ? ` · 내 팀 ${recordText(team.record)}` : ''}</p>
  {#if gain != null}
    <p class="fs-sm" data-rating-change>내 팀 레이팅 <b>{signedNum(gain)}</b></p>
  {/if}
  <div class="tm-actions">
    {#if onhistory}<button class="btn" onclick={onhistory} data-act="team-result-history">기록으로 돌아가기</button>{:else}<button class="btn" onclick={ontoTeam}>편성으로</button>{/if}
    <button class="btn" onclick={onreplay} data-act="team-replay">중계 다시 보기</button>
    <button class="btn btn-primary" onclick={onagain} disabled={matchesLeft === 0}>다시 경기하기</button>
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
  .tm-min {
    flex: none;
    font-family: var(--display);
    font-weight: 700;
    color: var(--muted);
    min-width: 2.2em;
  }
</style>
