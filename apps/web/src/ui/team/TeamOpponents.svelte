<script lang="ts">
  import TeamLogo from './TeamLogo.svelte';
  import TitleBadge from '../cup/TitleBadge.svelte';
  // 상대 고르기 — 내 팀 레이팅에 가까운 다른 구단주의 팀에 도전한다(레이팅이 크게, OVR은 작게). 경기할 수 없으면(hint) 목록 대신 이유를 보여 준다.
  // T-11-510 시즌 2(ladder)는 서버가 고른 상대 한 팀과 '다른 상대 찾기'(경기마다 3번)를 보여 준다.
  import { RANK_MATCH_REPICKS, TEAM_REPEAT_WINDOW_DAYS } from '@offside/contracts/owner-team';
  import type { TeamOpponent } from '@offside/app-core/api/team';
  import { ratingGap, recordText } from '@offside/app-core/teamText';
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
    ladder = false,
    repicksLeft = 0,
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
    ladder?: boolean;
    /** 이번 경기에서 남은 '다른 상대 찾기' 횟수. */
    repicksLeft?: number;
  } = $props();
</script>

<section class="card stack" style="gap:12px">
  <div>
    <div class="eyebrow">Match</div>
    <h1>{ladder ? L.matchTitle : L.oppTitle}</h1>
    {#if !hint}<p class="muted fs-sm">{ladder ? L.matchNear({ rp: rating, left: matchesLeft, per: perDay }) : L.oppNear({ rating, left: matchesLeft, per: perDay })}</p>{/if}
    <p class="muted fs-xs">{ladder ? L.matchRule({ n: RANK_MATCH_REPICKS }) : L.oppRuleWeb({ days: TEAM_REPEAT_WINDOW_DAYS })}</p>
    {#if !hint && opponents.length}<p class="muted fs-xs" data-opponent-gap-note>{ladder ? L.matchGapNote : L.oppGapNote}</p>{/if}
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
      {@const gap = ratingGap(rating, o.rating)}
      <div class="tm-opp" data-opponent={o.teamId}>
        <TeamLogo logo={o.logo} name={o.name} size={32} decorative />
        <div class="tm-opp-info">
          <b>{o.name}{#if o.title} <TitleBadge title={o.title} size="icon" />{/if}</b>
          <span class="muted fs-sm">{o.owner} · {o.shape ?? o.formation} · {recordText(o.record)}</span>
        </div>
        <span class="tm-opp-score" data-opponent-rating={o.rating}><small class="muted">{ladder ? L.oppRp : L.oppRating}</small><b>{o.rating}</b><small class="tm-opp-gap" data-opponent-gap={gap.d}><span aria-hidden="true">{gap.text}</span><span class="sr-only">{gap.aria}</span></small><small class="muted">{L.oppOvr({ n: o.ovr })}</small></span>
        <button class="btn btn-primary btn-sm" disabled={playing || matchesLeft === 0} onclick={() => onchallenge(o)} aria-label={ladder ? L.matchStartAria({ name: o.name }) : undefined} data-act="team-challenge">{ladder ? L.matchStart : L.challenge}</button>
      </div>
    {:else}
      <p class="muted">{L.noOpponents}</p>
    {/each}
    {#if ladder}
      <button class="icon-btn self-start" onclick={onmore} disabled={playing || repicksLeft <= 0} data-act="team-repick">{L.matchRepick({ left: repicksLeft, max: RANK_MATCH_REPICKS })}</button>
    {:else}
      <button class="icon-btn self-start" onclick={onmore} disabled={playing}>{L.moreOpponents}</button>
    {/if}
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
    font-size: var(--fs-title2);
    font-weight: 700;
    color: var(--accent-text);
  }
  .tm-opp-score small {
    font-size: var(--fs-caption2);
  }
  .tm-opp-score .tm-opp-gap {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--muted);
  }
</style>
