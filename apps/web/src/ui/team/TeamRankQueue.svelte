<script lang="ts">
  // T-11-603 랭크 매칭 큐: 첫 화면(내 팀 정보 + 매칭 찾기) → 찾는 중(반경 · 시간 · 취소) → 매칭 완료(두 팀 · 걸린 RP · 경기 시작).
  // 상대는 누른 뒤에야 받는다. 찾는 시간은 연출이고(rankQueue queueWaitMs) 서버 응답이 늦으면 그만큼 더 기다린다.
  import { onDestroy } from 'svelte';
  import { RANK_REPICKS_DAILY } from '@offside/contracts/owner-team';
  import { fetchOpponents, type OwnerTeam, type TeamMatch, type TeamOpponent } from '@offside/app-core/api/team';
  import { teamMatchText as L } from '@offside/app-core/i18n/ko/teamMatch';
  import { queueClock, queueStep, queueWaitMs, rankStakes, repicksLeft as repicksLeftToday, spendRepick } from '@offside/app-core/rankQueue';
  import { loadKey, saveKey } from '@offside/game/storage';
  import { num, ratingGap, recordText, signedNum } from '@offside/app-core/teamText';
  import { buzz, motionOK } from '../motion';
  import TitleBadge from '../cup/TitleBadge.svelte';
  import TeamLogo from './TeamLogo.svelte';
  import TeamRankInfo from './TeamRankInfo.svelte';
  import TeamRankSquad from './TeamRankSquad.svelte';

  let {
    team,
    teamLogo,
    matchesLeft,
    perDay,
    playing,
    found = $bindable(),
    pick = $bindable(),
    onchallenge,
    onopenmatch,
  }: {
    team: OwnerTeam;
    teamLogo: OwnerTeam['logo'];
    matchesLeft: number;
    perDay: number;
    playing: boolean;
    /** 찾은 상대(경기를 치르거나 상대가 무효가 되면 부모가 비운다). */
    found: TeamOpponent | null;
    /** 이번 경기에서 다시 찾은 횟수. */
    pick: number;
    onchallenge: (o: TeamOpponent) => void;
    onopenmatch: (m: TeamMatch) => void;
  } = $props();

  type Phase = 'idle' | 'searching' | 'empty' | 'error';
  let phase = $state<Phase>('idle');
  let sec = $state(0);
  /** 방금 찾았을 때만 등장 효과를 준다(다른 탭을 다녀오면 바로 보인다). */
  let reveal = $state(false);
  let run = 0;
  let timer: ReturnType<typeof setInterval> | undefined;

  const stopTimer = () => {
    if (timer) clearInterval(timer);
    timer = undefined;
  };
  const stakes = $derived(found ? rankStakes(team, found.rating) : null);
  const gap = $derived(found ? ratingGap(team.rating, found.rating) : null);
  // T-11-702 다른 상대 찾기는 하루 5번(이 브라우저에서 센다).
  const REPICK_KEY = 'ft_rank_repick';
  let repicksLeft = $state(repicksLeftToday(loadKey<string>(REPICK_KEY)));

  async function search(repick = false) {
    const mine = ++run;
    phase = 'searching';
    sec = 0;
    stopTimer();
    timer = setInterval(() => (sec += 1), 1000);
    const [r] = await Promise.all([
      fetchOpponents(repick ? pick + 1 : pick),
      new Promise((done) => setTimeout(done, queueWaitMs({ repick, motionOK }))),
    ]);
    // 취소했거나 화면을 떠났으면 응답을 버린다. 다시 찾기 횟수도 쓰지 않는다.
    if (mine !== run) return;
    stopTimer();
    if (!r.ok) {
      phase = 'error';
      return;
    }
    const o = r.data.items[0];
    if (!o) {
      phase = 'empty';
      return;
    }
    if (repick) {
      pick += 1;
      const spent = spendRepick(loadKey<string>(REPICK_KEY));
      saveKey(REPICK_KEY, spent);
      repicksLeft = repicksLeftToday(spent);
    }
    found = o;
    reveal = true;
    phase = 'idle';
    buzz(30);
  }

  function cancel() {
    run += 1;
    stopTimer();
    phase = 'idle';
  }

  onDestroy(() => {
    run += 1;
    stopTimer();
  });
</script>

{#if phase === 'searching'}
  <div class="rq-search" role="status" data-queue-phase="searching">
    <div class="rq-radar" aria-hidden="true">
      <i class="rq-ring"></i><i class="rq-ring r2"></i><i class="rq-ring r3"></i><i class="rq-sweep"></i>
      <span class="rq-core"><TeamLogo logo={teamLogo} name={team.name} size={56} decorative /></span>
    </div>
    <b class="rq-title">{L.queueTitle}</b>
    <span class="rq-clock" data-queue-clock aria-hidden="true">{queueClock(sec)}</span>
    <small class="muted">{queueStep(sec)}</small>
    <button class="btn" onclick={cancel} data-act="team-queue-cancel">{L.queueCancel}</button>
  </div>
{:else if found && stakes && gap}
  <div class="rq-found" class:reveal data-queue-phase="found">
    <p class="rq-found-title" role="status">{L.queueFound}</p>
    <div class="rq-vs">
      <div class="rq-side me">
        <TeamLogo logo={teamLogo} name={team.name} size={56} decorative />
        <b>{team.name}</b>
        <small class="muted">{L.queueMe}</small>
        <span class="rq-rp">{num(team.rating)} <small>{L.oppRp}</small></span>
      </div>
      <span class="rq-vs-mark" aria-hidden="true">VS</span>
      <div class="rq-side opp" data-opponent={found.teamId}>
        <TeamLogo logo={found.logo} name={found.name} size={56} decorative />
        <b>{found.name}{#if found.title} <TitleBadge title={found.title} size="icon" />{/if}</b>
        <small class="muted">{found.owner}</small>
        <span class="rq-rp" data-opponent-rating={found.rating}>{num(found.rating)} <small>{L.oppRp}</small></span>
        <small class="rq-gap" data-opponent-gap={gap.d}><span aria-hidden="true">{gap.text}</span><span class="sr-only">{gap.aria}</span></small>
      </div>
    </div>
    <p class="muted fs-sm rq-opp-line">{found.shape ?? found.formation} · {L.oppOvr({ n: found.ovr })} · {recordText(found.record)}</p>
    <div class="rq-stakes" data-rank-stakes>
      <small class="muted">{L.stakesTitle}</small>
      <div class="rq-stake-row">
        <span class="w"><small>{L.stakesWin}</small><b data-stake-win={stakes.win}>{signedNum(stakes.win)}</b></span>
        <span><small>{L.stakesDraw}</small><b>{signedNum(stakes.draw)}</b></span>
        <span class="l"><small>{L.stakesLoss}</small><b>{signedNum(stakes.loss)}</b></span>
      </div>
      {#if stakes.promote}<p class="rq-note up" data-stake-promote>{stakes.promote}</p>{/if}
      {#if stakes.relegate}<p class="rq-note down" data-stake-relegate>{stakes.relegate}</p>{/if}
    </div>
    {#if found.odds}
      <div class="rq-stakes" data-rank-odds role="img" aria-label={L.oddsAria(found.odds)}>
        <small class="muted">{L.oddsTitle}</small>
        <div class="rq-odds-bar" aria-hidden="true">
          <i class="w" style="flex:{Math.max(found.odds.win, 1)}"></i>
          <i style="flex:{Math.max(found.odds.draw, 1)}"></i>
          <i class="l" style="flex:{Math.max(found.odds.loss, 1)}"></i>
        </div>
        <div class="rq-stake-row" aria-hidden="true">
          <span class="w"><small>{L.oddsWin}</small><b data-odds-win={found.odds.win}>{found.odds.win}%</b></span>
          <span><small>{L.oddsDraw}</small><b>{found.odds.draw}%</b></span>
          <span class="l"><small>{L.oddsLoss}</small><b>{found.odds.loss}%</b></span>
        </div>
        <small class="muted">{L.oddsNote}</small>
      </div>
    {/if}
    <div class="rq-actions">
      <button class="btn btn-primary rq-go" disabled={playing || matchesLeft === 0} onclick={() => onchallenge(found!)} aria-label={L.matchStartAria({ name: found.name })} data-act="team-challenge">{L.matchStart}</button>
      <button class="btn rq-go" onclick={() => void search(true)} disabled={playing || repicksLeft <= 0} aria-label={L.matchRepick({ left: repicksLeft, max: RANK_REPICKS_DAILY })} data-act="team-repick">{L.matchRepickBtn({ left: repicksLeft, max: RANK_REPICKS_DAILY })}</button>
    </div>
    {#if phase === 'error'}<p class="muted fs-sm" role="alert">{L.oppLoadFail}</p>{/if}
    {#if phase === 'empty'}<p class="muted fs-sm" role="status">{L.queueEmpty}</p>{/if}
    <p class="muted fs-xs">{L.matchGapNote}</p>
    <TeamRankSquad opponentId={found.teamId} myId={team.id} />
  </div>
{:else}
  <TeamRankInfo {team} {matchesLeft} {perDay} onopen={onopenmatch}>
    {#snippet action()}
      <div class="rq-idle" data-queue-phase={phase}>
        {#if phase === 'error'}<p class="muted" role="alert">{L.oppLoadFail}</p>{/if}
        {#if phase === 'empty'}<p class="muted" role="status">{L.queueEmpty}</p>{/if}
        <button class="btn btn-primary rq-go" disabled={playing || matchesLeft === 0} onclick={() => void search()} data-act="team-find-match">{phase === 'idle' ? L.queueFind : L.queueAgain}</button>
      </div>
    {/snippet}
  </TeamRankInfo>
{/if}

<style>
  .rq-search,
  .rq-found,
  .rq-idle {display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center;}
  .rq-search {padding: 12px 0 4px;}
  .rq-search .btn {margin-top: 6px;}
  .rq-actions {width: 100%; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px;}
  .rq-go {width: 100%; min-height: 48px; font-size: var(--fs-body); font-weight: 700;}
  /* 찾는 중: 내 엠블럼에서 번지는 고리와 도는 빛. 위치를 맞추려 카드 폭과 상관없이 정사각형으로 둔다. */
  .rq-radar {position: relative; width: 180px; height: 180px; display: grid; place-items: center; margin-bottom: 4px;}
  .rq-core {position: relative; z-index: 1; width: 84px; height: 84px; display: grid; place-items: center; border-radius: 50%; background: var(--surface); border: 2px solid var(--accent); animation: rq-breathe 1.4s ease-in-out infinite;}
  .rq-ring {position: absolute; inset: 0; border-radius: 50%; border: 2px solid var(--accent); opacity: 0; animation: rq-ring 2.1s cubic-bezier(.2,.6,.4,1) infinite;}
  .rq-ring.r2 {animation-delay: .7s;}
  .rq-ring.r3 {animation-delay: 1.4s;}
  .rq-sweep {position: absolute; inset: 14px; border-radius: 50%; background: conic-gradient(from 0deg, transparent 0 70%, color-mix(in srgb, var(--accent) 45%, transparent) 100%); animation: rq-spin 1.6s linear infinite;}
  .rq-title {font-size: var(--fs-title3);}
  .rq-clock {font-family: var(--display); font-size: var(--fs-title2); font-weight: 700; font-variant-numeric: tabular-nums; color: var(--accent-text);}
  @keyframes rq-ring {0% {transform: scale(.42); opacity: .75;} 100% {transform: scale(1); opacity: 0;}}
  @keyframes rq-spin {to {transform: rotate(360deg);}}
  @keyframes rq-breathe {0%,100% {transform: scale(1);} 50% {transform: scale(1.05);}}
  /* 매칭 완료 */
  .rq-found-title {margin: 0; font-family: var(--display); font-size: var(--fs-title2); font-weight: 700; color: var(--accent-text);}
  .rq-vs {width: 100%; display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: start; gap: 8px;}
  .rq-side {display: flex; flex-direction: column; align-items: center; gap: 3px; min-width: 0; overflow-wrap: anywhere;}
  .rq-vs-mark {margin-top: 14px; font-family: var(--display); font-size: var(--fs-title2); font-weight: 800; color: var(--muted);}
  .rq-rp {font-family: var(--display); font-weight: 700; font-size: var(--fs-title3); color: var(--accent-text); font-variant-numeric: tabular-nums;}
  .rq-rp small {font-size: var(--fs-caption2);}
  .rq-gap {font-weight: 700; font-size: var(--fs-caption2); color: var(--muted); font-variant-numeric: tabular-nums;}
  .rq-opp-line {margin: 0;}
  .rq-stakes {width: 100%; display: grid; gap: 6px; padding: 10px; border-radius: 12px; background: color-mix(in srgb, var(--ink) 4%, var(--surface));}
  .rq-stake-row {display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px;}
  .rq-stake-row span {display: grid; line-height: 1.25;}
  .rq-stake-row small {font-size: var(--fs-caption2); color: var(--muted);}
  .rq-stake-row b {font-variant-numeric: tabular-nums;}
  .rq-stake-row .w b {color: var(--accent-text);}
  .rq-stake-row .l b {color: var(--bad);}
  .rq-odds-bar {display: flex; gap: 2px; height: 6px; border-radius: 3px; overflow: hidden;}
  .rq-odds-bar i {background: var(--line);}
  .rq-odds-bar i.w {background: var(--accent);}
  .rq-odds-bar i.l {background: var(--bad);}
  .rq-note {margin: 0; font-size: var(--fs-body2); font-weight: 700;}
  .rq-note.up {color: var(--accent-text);}
  .rq-note.down {color: var(--bad);}
  .reveal .rq-found-title {animation: rq-pop .45s cubic-bezier(.2,1.4,.4,1) both;}
  .reveal .rq-side.me {animation: rq-in-left .45s cubic-bezier(.2,.8,.3,1) .1s both;}
  .reveal .rq-side.opp {animation: rq-in-right .45s cubic-bezier(.2,.8,.3,1) .1s both;}
  .reveal .rq-vs-mark {margin-top: 14px; animation: rq-pop .4s cubic-bezier(.2,1.6,.4,1) .4s both;}
  .reveal .rq-stakes,
  .reveal .rq-opp-line {animation: rq-rise .35s ease-out .5s both;}
  @keyframes rq-pop {from {transform: scale(.5); opacity: 0;} to {transform: scale(1); opacity: 1;}}
  @keyframes rq-in-left {from {transform: translateX(-40px); opacity: 0;} to {transform: none; opacity: 1;}}
  @keyframes rq-in-right {from {transform: translateX(40px); opacity: 0;} to {transform: none; opacity: 1;}}
  @keyframes rq-rise {from {transform: translateY(8px); opacity: 0;} to {transform: none; opacity: 1;}}
  @media (prefers-reduced-motion: reduce) {
    .rq-ring, .rq-sweep, .rq-core, .reveal * {animation: none !important;}
    .rq-ring {opacity: .3;}
  }
</style>
