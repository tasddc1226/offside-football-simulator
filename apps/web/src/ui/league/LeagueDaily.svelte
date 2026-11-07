<script lang="ts">
  // T-11-652 오프사이드 데일리 — 끝난 라운드 신문(이변 · 골 잔치 · 더비 · 선두 · 연승 · 이 라운드의 팀), 다음 라운드 빅매치
  // 예측(보상 없이 적중 기록만), 기사 라운지 공유. 리그 화면을 열 때만 불러온다.
  import { onMount } from 'svelte';
  import {
    fetchLeagueNews,
    fetchLeaguePredictionCounts,
    fetchLeaguePredictionsMe,
    putLeaguePrediction,
    type LeagueNewsMatch,
    type LeagueNewsResponse,
    type LeaguePredictionCounts,
    type LeaguePredictionMeResponse,
    type LeaguePredictionPick,
  } from '@offside/app-core/api/league';
  import { leagueNewsText as N } from '@offside/app-core/i18n/ko/leagueNews';
  import { lastBigLine, newsCards, pickLabel, predictionSplit } from '@offside/app-core/leagueNews';
  import { leagueWhen } from '@offside/app-core/leagueView';
  import { toast } from '../helpers.js';
  import { shareToLounge } from '../team/loungeShare.js';
  import TeamLogo from '../team/TeamLogo.svelte';
  import Skeleton from '../Skeleton.svelte';
  import { shellMoreText } from '@offside/app-core/i18n/ko/shellMore';

  let { season, round, linked, onopen }: {
    season: number;
    /** 끝난 라운드 수(0이면 1라운드 빅매치만). */
    round: number;
    linked: boolean;
    onopen: (m: LeagueNewsMatch) => void;
  } = $props();

  let news = $state<LeagueNewsResponse | null>(null);
  let failed = $state(false);
  let counts = $state<LeaguePredictionCounts | null>(null);
  let mine = $state<LeaguePredictionMeResponse | null>(null);
  let busy = $state(false);
  let sharing = $state(false);

  async function load() {
    failed = false;
    const r = await fetchLeagueNews(season, round);
    if (!r.ok) return (failed = true);
    news = r.data;
    const big = r.data.bigMatch;
    if (big) {
      const c = await fetchLeaguePredictionCounts(season, big.id);
      if (c.ok) counts = c.data;
    }
  }
  onMount(() => void load());
  $effect(() => {
    if (!linked) return void (mine = null);
    void fetchLeaguePredictionsMe(season).then((r) => (mine = r.ok ? r.data : null));
  });

  const cards = $derived(news ? newsCards(news) : []);
  const big = $derived(news?.bigMatch ?? null);
  const last = $derived(news ? lastBigLine(news) : null);
  const myPick = $derived(big ? (mine?.items.find((x) => x.matchId === big.id)?.pick ?? null) : null);
  const split = $derived(counts ? predictionSplit(counts) : null);
  const open = $derived(!!big && Date.parse(big.at) > Date.now());

  async function pick(p: LeaguePredictionPick) {
    if (!big || busy) return;
    if (!linked) return toast(N.pickLogin);
    busy = true;
    const r = await putLeaguePrediction(season, big.id, p);
    busy = false;
    if (!r.ok) return toast(r.error.message || N.pickFail);
    counts = r.data;
    const items = (mine?.items ?? []).filter((x) => x.matchId !== big.id);
    mine = {
      hit: mine?.hit ?? 0,
      total: mine?.total ?? 0,
      items: [{ matchId: big.id, round: big.round, pick: p, result: null }, ...items],
    };
    toast(N.pickSaved);
  }
  async function share(m: LeagueNewsMatch) {
    if (sharing) return;
    sharing = true;
    await shareToLounge({ kind: 'leagueMatch', season, matchId: m.id });
    sharing = false;
  }
</script>

<section class="card ld" data-league-daily={round}>
  <header class="ld-head">
    <div>
      <div class="ld-mast">{N.title}</div>
      {#if round > 0}<small class="muted">{N.edition({ round })}</small>{/if}
    </div>
    {#if mine && mine.total > 0}<span class="pill" data-league-pred-record>{N.record({ hit: mine.hit, total: mine.total })}</span>{/if}
  </header>

  {#if failed}
    <div class="ld-row"><span class="muted fs-sm">{N.loadFail}</span><button class="btn btn-sm" data-act="league-daily-retry" onclick={() => void load()}>{shellMoreText.retry}</button></div>
  {:else if news}
    {#if round === 0}
      <p class="muted fs-sm" data-league-daily-first>{N.firstSoon}</p>
    {:else if !cards.length}
      <p class="muted fs-sm">{N.quiet}</p>
    {/if}
    {#each cards as c, i (c.key)}
      <article class="ld-item" class:lead={i === 0} data-league-news={c.kind}>
        <div class="ld-tagrow"><span class="pill ld-tag" class:hot={c.kind === 'upset'}>{c.tag}</span><small class="muted">{c.where}</small></div>
        <h3>{c.head}</h3>
        <p class="fs-sm">{c.body}</p>
        {#if c.match}
          {@const m = c.match}
          <div class="ld-acts">
            <button class="ld-link" type="button" data-act="league-news-open" onclick={() => onopen(m)}>{N.readArticle} ›</button>
            {#if linked}<button class="ld-link" type="button" data-act="league-news-share" aria-label={N.shareAria({ home: m.home.name, away: m.away.name })} disabled={sharing} onclick={() => void share(m)}>{N.shareAct}</button>{/if}
          </div>
        {/if}
      </article>
    {/each}

    {#if big}
      <div class="ld-big" data-league-big={big.id}>
        <div class="ld-tagrow"><span class="pill good ld-tag">{N.tagBig}</span><small class="muted">{N.where({ tier: big.tier, league: big.league, round: big.round })}</small></div>
        <h3>{N.bigTitle}</h3>
        <div class="ld-vs">
          <span class="ld-team"><TeamLogo logo={big.home.logo} name={big.home.name} size={32} decorative /><b>{big.home.name}</b><small class="muted">{N.rankOvr({ rank: big.homeRank, ovr: big.home.ovr })}</small></span>
          <span class="ld-v">VS</span>
          <span class="ld-team away"><TeamLogo logo={big.away.logo} name={big.away.name} size={32} decorative /><b>{big.away.name}</b><small class="muted">{N.rankOvr({ rank: big.awayRank, ovr: big.away.ovr })}</small></span>
        </div>
        <small class="muted">{N.bigWhen({ when: leagueWhen(big.at) })}</small>
        {#if open}
          <div class="ld-picks" role="group" aria-label={N.bigTitle}>
            {#each ['home', 'draw', 'away'] as const as p (p)}
              <button class="btn btn-sm" class:btn-primary={myPick === p} type="button" data-act="league-pick" data-pick={p} aria-pressed={myPick === p} disabled={busy} onclick={() => void pick(p)}>{pickLabel(p)}</button>
            {/each}
          </div>
        {/if}
        {#if myPick}<small data-league-my-pick={myPick}>{N.picked({ pick: pickLabel(myPick) })}</small>{/if}
        {#if split}
          <div class="ld-bar" aria-hidden="true"><span style="width:{split.home}%"></span><span class="d" style="width:{split.draw}%"></span><span class="a" style="width:{split.away}%"></span></div>
          <small class="muted" data-league-pred-split>{split.line}</small>
        {/if}
      </div>
    {/if}
    {#if last}<p class="muted fs-xs" data-league-last-big>{last}</p>{/if}
  {:else}
    <Skeleton height={160} />
  {/if}
</section>

<style>
  .ld { display: flex; flex-direction: column; gap: 12px; }
  .ld h3, .ld p { margin: 0; }
  .ld-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; border-bottom: 2px solid var(--text); padding-bottom: 8px; }
  .ld-mast { font-family: var(--display); font-size: 1.35rem; font-weight: 800; letter-spacing: -0.01em; line-height: 1.1; }
  .ld-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .ld-item { display: flex; flex-direction: column; gap: 6px; padding-bottom: 12px; border-bottom: 1px solid var(--line); }
  .ld-item h3 { font-size: 1rem; line-height: 1.35; }
  .ld-item.lead h3 { font-size: 1.15rem; }
  .ld-item p { line-height: 1.55; }
  .ld-tagrow { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .ld-tag { font-size: 11px; }
  .ld-tag.hot { background: var(--warn); color: var(--on-accent, #fff); border-color: transparent; }
  .ld-acts { display: flex; gap: 16px; flex-wrap: wrap; margin-top: -4px; }
  .ld-link { min-height: 44px; padding: 0 2px; border: 0; background: transparent; color: var(--accent-text); font: inherit; font-size: var(--fs-body2); font-weight: 600; cursor: pointer; }
  .ld-link:disabled { opacity: 0.5; cursor: default; }
  .ld-big { display: flex; flex-direction: column; gap: 8px; padding: 12px; border: 1px solid var(--line); border-radius: var(--radius-md, 12px); background: var(--surface-2, transparent); }
  .ld-vs { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 8px; }
  .ld-team { display: flex; flex-direction: column; gap: 2px; min-width: 0; overflow-wrap: anywhere; }
  .ld-team.away { align-items: flex-end; text-align: right; }
  .ld-v { font-family: var(--display); font-weight: 800; color: var(--muted); }
  .ld-picks { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .ld-bar { display: flex; height: 6px; border-radius: 3px; overflow: hidden; background: var(--line); }
  .ld-bar span { background: var(--accent); }
  .ld-bar .d { background: var(--muted); }
  .ld-bar .a { background: var(--warn); }
</style>
