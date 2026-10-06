<script lang="ts">
  import TeamLogo from './TeamLogo.svelte';
  // 상대 고르기 — 내 팀 레이팅에 가까운 다른 구단주의 팀에 도전한다(레이팅이 크게, OVR은 작게). 경기할 수 없으면(hint) 목록 대신 이유를 보여 준다.
  import { TEAM_REPEAT_WINDOW_DAYS } from '@offside/contracts/owner-team';
  import type { TeamOpponent } from '@offside/app-core/api/team';
  import { recordText } from '@offside/app-core/teamText';
  import { teamMatchText as L } from '@offside/app-core/i18n/ko/teamMatch';
  import LoadState, { type LoadStatus } from '../LoadState.svelte';

  let {
    rating,
    matchesLeft,
    perDay,
    opponents,
    status,
    playing,
    hint,
    onreload,
    onchallenge,
    onmore,
    ontoTeam,
    onsave,
    saving = false,
    saveDisabled = false,
  }: {
    rating: number;
    matchesLeft: number;
    perDay: number;
    opponents: TeamOpponent[];
    status: LoadStatus;
    playing: boolean;
    /** 지금은 경기할 수 없는 이유(경기할 수 있으면 비어 있다). */
    hint: string | null;
    onreload: () => void;
    onchallenge: (o: TeamOpponent) => void;
    /** '다른 상대 보기' — 목록을 다시 불러온다. */
    onmore: () => void;
    /** 편성 화면으로(편집할 수 있을 때만 넘긴다). */
    ontoTeam?: (() => void) | undefined;
    onsave?: (() => void) | undefined;
    saving?: boolean;
    saveDisabled?: boolean;
  } = $props();
</script>

<section class="card stack" style="gap:12px">
  <div>
    <div class="eyebrow">Match</div>
    <h1>{L.oppTitle}</h1>
    {#if !hint}<p class="muted fs-sm">{L.oppNear({ rating, left: matchesLeft, per: perDay })}</p>{/if}
    <p class="muted fs-xs">{L.oppRuleWeb({ days: TEAM_REPEAT_WINDOW_DAYS })}</p>
  </div>
  {#if hint}
    <p class="muted" data-match-hint>{onsave ? L.saveToSee : hint}</p>
    <div class="tm-match-actions">
      {#if onsave}<button class="btn btn-primary" onclick={onsave} disabled={saving || saveDisabled} data-act="team-save-opponents">{saving ? L.saving : L.saveAndFind}</button>{/if}
      {#if ontoTeam}<button class="btn" onclick={ontoTeam}>{L.toLineup}</button>{/if}
    </div>
  {:else}
  <LoadState {status} failText={L.oppLoadFail} retry={onreload}>
    {#each opponents as o (o.teamId)}
      <div class="tm-opp" data-opponent={o.teamId}>
        <TeamLogo logo={o.logo} name={o.name} size={32} decorative />
        <div class="tm-opp-info">
          <b>{o.name}</b>
          <span class="muted fs-sm">{o.owner} · {o.formation} · {recordText(o.record)}</span>
        </div>
        <span class="tm-opp-score" data-opponent-rating={o.rating}><small class="muted">{L.oppRating}</small><b>{o.rating}</b><small class="muted">{L.oppOvr({ n: o.ovr })}</small></span>
        <button class="btn btn-primary btn-sm" disabled={playing || matchesLeft === 0} onclick={() => onchallenge(o)} data-act="team-challenge">{L.challenge}</button>
      </div>
    {:else}
      <p class="muted">{L.noOpponents}</p>
    {/each}
    <button class="icon-btn self-start" onclick={onmore} disabled={playing}>{L.moreOpponents}</button>
  </LoadState>
  {/if}
</section>

<style>
  .tm-match-actions {display:flex;flex-wrap:wrap;gap:8px;}
  .tm-opp {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 0;
    border-top: 1px solid var(--line);
  }
  .tm-opp-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .tm-opp-score {
    flex: none;
    min-width: 3.4em;
    display: grid;
    justify-items: center;
    line-height: 1.1;
  }
  .tm-opp-score b {
    font-family: var(--display);
    font-size: 1.375rem;
    font-weight: 700;
    color: var(--accent-text);
  }
  .tm-opp-score small {
    font-size: 0.6875rem;
  }
</style>
