<script lang="ts">
  // T-11-128 구단주 시즌 결산 — 끝난 시즌의 기록(서버가 굳힌 값)과 받은 휘장을 한 화면에 모아 보여 준다.
  // 구단주 화면의 '시즌 결산' 카드로 연다. 열면 그 시즌 결산을 '봤다'고 표시한다(카드의 NEW).
  // 맨 위 시즌 카드(등급 · 한 줄 요약 · 자랑거리) → 선수단(단체사진 · 카드 흐름) → 숫자 → 이 시즌의 얼굴 → 카드 등급 → 팀 → 순위 → 휘장 → 남긴 기록 순.
  // '결산 공유하기'는 같은 값을 4:5 한 장으로 그린다(recapShareCard.ts).
  import Topbar from './Topbar.svelte';
  import BackBar from './BackBar.svelte';
  import HonorEmblem from './HonorEmblem.svelte';
  import GradeEmblem from './team/GradeEmblem.svelte';
  import PlayerCard from './team/PlayerCard.svelte';
  import RecapTeamPhoto from './recap/RecapTeamPhoto.svelte';
  import RecapCardReel from './recap/RecapCardReel.svelte';
  import ShareSheet from './share/ShareSheet.svelte';
  import { go } from './nav.js';
  import { motionOK } from './motion.js';
  import { appState } from './state.svelte.js';
  import { fetchOwnerHonors, fetchSeasonRecap, type SeasonRecapResponse } from '@offside/app-core/api/seasonRecap';
  import {
    CARD_TIER_SWATCH,
    honorViews,
    markRecapSeen,
    rankText,
    recapRanks,
    recapCutoffText,
    recapHeadline,
    recapHighlights,
    recapNumbers,
    recapStatusText,
    recapTeamSummary,
    recapTierBars,
    signed,
  } from '@offside/app-core/seasonRecap';
  import { teamSeasonLabel } from '@offside/app-core/seasonName';
  import { detailPosOf } from '@offside/contracts/positions';
  import { cardTier, playerName } from '@offside/app-core/format';
  import { num, recordText } from '@offside/app-core/teamText';
  import { seasonRecapText as L } from '@offside/app-core/i18n/ko/seasonRecap';
  import { ownerText as O } from '@offside/app-core/i18n/ko/owner';
  import { recapTier, tierReason, tierTitle } from '@offside/app-core/ownerTier';
  import { EMBLEM_PALETTE } from '@offside/app-core/gradeEmblem';

  let seasons = $state<number[]>([]);
  let season = $state<number | null>(null);
  let res = $state<SeasonRecapResponse | null>(null);
  let failed = $state(false);
  let sharing = $state(false);
  // 시즌을 빠르게 바꿨을 때 늦게 온 응답이 덮어쓰지 않게 하는 번호.
  let seq = 0;

  async function load(target?: number) {
    const my = ++seq;
    failed = false;
    res = null;
    // 목록은 처음 한 번만(60초 메모). 시즌을 고르지 않았으면 가장 최근에 끝난 시즌.
    if (seasons.length === 0) {
      const h = await fetchOwnerHonors();
      if (my !== seq) return;
      if (!h.ok) return void (failed = true);
      seasons = h.data.seasons;
    }
    const s = target ?? season ?? seasons.at(-1);
    if (s === undefined) return void (failed = true);
    const r = await fetchSeasonRecap(s);
    if (my !== seq) return;
    if (!r.ok) return void (failed = true);
    season = r.data.season;
    res = r.data;
    if (r.data.status === 'ready') {
      markRecapSeen(r.data.season);
      appState.recapNew = false;
    }
  }
  $effect(() => {
    void load();
  });

  const name = $derived(res ? teamSeasonLabel(res.season) : '');
  const recap = $derived(res?.status === 'ready' ? res.recap : null);
  const honors = $derived(res ? honorViews(res.honors) : []);
  const tier = $derived(recap ? recapTier(recap) : null);
  const numbers = $derived(recap ? recapNumbers(recap) : []);
  const bars = $derived(recap ? recapTierBars(recap) : []);
  const highlights = $derived(recap ? recapHighlights(recap) : []);
  const ranks = $derived(recap ? recapRanks(recap) : []);

  /** 숫자가 0에서 차오른다(화면에 들어올 때 한 번). 움직임 줄이기면 바로 값. */
  function countUp(node: HTMLElement, value: number) {
    let raf = 0;
    let io: IntersectionObserver | undefined;
    const run = (to: number) => {
      cancelAnimationFrame(raf);
      io?.disconnect();
      if (!motionOK || to === 0 || typeof IntersectionObserver !== 'function') {
        node.textContent = num(to);
        return;
      }
      node.textContent = '0';
      io = new IntersectionObserver(([entry]) => {
        if (!entry?.isIntersecting) return;
        io?.disconnect();
        const start = performance.now();
        const step = (t: number) => {
          const k = Math.min(1, (t - start) / 1100);
          node.textContent = num(Math.round(to * (1 - (1 - k) ** 3)));
          if (k < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      });
      io.observe(node);
    };
    run(value);
    return { update: run, destroy: () => (cancelAnimationFrame(raf), io?.disconnect()) };
  }

  const makeShare = async () => {
    const { makeRecapShareFile } = await import('./recapShareCard.js');
    if (!recap) throw new Error('no recap');
    return makeRecapShareFile(recap);
  };
</script>

{#snippet stat(label: string, value: string, key?: string)}
  <div data-recap-stat={key}><dt>{label}</dt><dd>{value}</dd></div>
{/snippet}

{#snippet shareButton(where: string)}
  <button class="btn btn-primary recap-share-btn" data-act="recap-share" data-where={where} onclick={() => (sharing = true)}>
    <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 13V3M6 7l4-4 4 4M4 11v5h12v-5" /></svg>
    {L.shareBtn}
  </button>
{/snippet}

<div class="wrap recap" data-recap>
  <Topbar />
  <header class="settings-head">
    <div class="eyebrow">Season recap</div>
    <h1>{L.title({ season: name || (season !== null ? teamSeasonLabel(season) : L.cardTitle) })}</h1>
    {#if recap}<p class="muted fs-sm" data-recap-cutoff>{recapCutoffText(recap)}</p>{/if}
    {#if seasons.length > 1}
      <label class="recap-picker">
        <span class="muted fs-sm">{L.pickSeason}</span>
        <select data-recap-season value={String(season ?? '')} onchange={(e) => void load(Number(e.currentTarget.value))}>
          {#each [...seasons].reverse() as s (s)}<option value={String(s)}>{teamSeasonLabel(s)}</option>{/each}
        </select>
      </label>
    {/if}
  </header>

  {#if failed}
    <section class="card recap-fail" data-recap-error>
      <p class="muted">{L.loadFail}</p>
      <button class="btn" data-act="recap-retry" onclick={() => void load()}>{L.retry}</button>
    </section>
  {:else if !res}
    <section class="card"><p class="muted" aria-live="polite">…</p></section>
  {:else if res.status === 'pending'}
    <section class="card" data-recap-pending><p class="muted">{recapStatusText(res)}</p></section>
  {:else if res.status === 'none' || !recap}
    <section class="card" data-recap-none><p class="muted">{recapStatusText(res)}</p></section>
  {:else}
    {#if tier}
      <!-- 시즌 카드 — 시즌 등급(구단주 랭킹과 같은 업적 등급, 마감 업적 점수로)과 한 줄 요약, 자랑거리. 공유 이미지의 첫 화면과 같다. -->
      <section class="recap-hero" data-recap-section="tier" data-recap-tier={tier} style="--tier: {EMBLEM_PALETTE[tier].base}; --tier-light: {EMBLEM_PALETTE[tier].light}; --tier-mark: {EMBLEM_PALETTE[tier].mark}" aria-label={L.secTier}>
        <div class="hero-top"><span class="hero-brand">OFFSIDE</span><span class="hero-eyebrow">SEASON RECAP</span></div>
        <p class="hero-season">{name}</p>
        <div class="hero-emblem"><GradeEmblem id={tier} size={128} /></div>
        <b class="hero-tier" data-grade={tier}>{tierTitle({ tier, season: res.season })}</b>
        <span class="hero-reason num">{tierReason(recap)}</span>
        <p class="hero-headline" data-recap-headline>{recapHeadline(recap)}</p>
        {#if highlights.length > 0}
          <ul class="hero-pills" data-recap-highlights>
            {#each highlights as h, i (h)}<li style="--i: {i}">{h}</li>{/each}
          </ul>
        {/if}
        {@render shareButton('hero')}
      </section>
    {/if}

    {#if recap.squad && recap.squad.length > 0}
      <!-- 이 시즌의 선수단 — 단체사진과 끝없이 흐르는 카드. -->
      <section class="card recap-sec" data-recap-section="squad" aria-label={L.secSquad}>
        <h2>{L.secSquad}</h2>
        <p class="muted fs-sm sec-lead">{L.squadLead({ n: num(recap.retired) })}</p>
        <RecapTeamPhoto squad={recap.squad} season={name} />
        <RecapCardReel squad={recap.squad} />
      </section>
    {/if}

    <section class="card recap-sec" data-recap-section="numbers" aria-label={L.secNumbers}>
      <h2>{L.secNumbers}</h2>
      {#if recap.stats}<p class="muted fs-sm sec-lead">{L.numbersLead}</p>{/if}
      <dl class="big-numbers">
        {#each numbers as n (n.key)}
          <div data-recap-stat={n.key} class:lead={n.key === 'goals' || n.key === 'ballon'}>
            <dt>{n.label}</dt>
            <dd><span aria-hidden="true" use:countUp={n.value}>{num(n.value)}</span><span class="sr-only">{num(n.value)}</span></dd>
          </div>
        {/each}
      </dl>
    </section>

    {#if recap.best || recap.stats?.scorer}
      <section class="card recap-sec" data-recap-section="legacy" aria-label={L.secFace}>
        <h2>{L.secFace}</h2>
        <div class="faces">
          {#if recap.best}
            {@const b = recap.best}
            {@const t = cardTier(b.score, b.peak ?? 0)}
            {@const sw = CARD_TIER_SWATCH[t]}
            {@const bestName = playerName(b.name, b.pos, null)}
            <!-- 결산은 한 화면 안에서만 본다(다른 화면으로 넘어가지 않는다). 카드는 팀 화면 카드와 같은 모양. -->
            <div class="face face-best" class:with-card={!!b.card} data-recap-best={b.careerId} data-tier={t} style="--c-base:{sw.base};--c-dark:{sw.dark};--c-ink:{sw.ink};--c-line:{sw.line}">
              {#if b.card}
                <span class="face-card"><PlayerCard player={b.card} name={bestName} rating={b.card.peak} role={detailPosOf(b.card)} season={b.card.season} /></span>
              {/if}
              <span class="face-info">
                <small class="face-eyebrow">{L.best} · {L.cardTierName({ tier: t })}</small>
                <b class="face-name">{bestName}</b>
                <span class="face-sub">{b.pos}{b.lastClub ? ` · ${b.lastClub}` : ''}</span>
                <span class="face-score num">{L.bestScore({ score: num(b.score) })}</span>
                {#if b.peak}<span class="face-peak num">{L.peak} {b.peak}</span>{/if}
              </span>
            </div>
          {/if}
          {#if recap.stats?.scorer}
            {@const s = recap.stats.scorer}
            <div class="face face-scorer" data-recap-scorer={s.careerId}>
              <small class="face-eyebrow">{L.scorer}</small>
              <b class="face-name">{playerName(s.name, s.pos, null)}</b>
              <span class="face-sub">{s.pos}</span>
              <span class="face-goals num"><span aria-hidden="true" use:countUp={s.goals}>{num(s.goals)}</span><span class="sr-only">{num(s.goals)}</span><small>{L.numGoals}</small></span>
            </div>
          {/if}
        </div>
      </section>
    {/if}

    {#if bars.length > 0}
      <section class="card recap-sec" data-recap-section="cards" aria-label={L.secCards}>
        <h2>{L.secCards}</h2>
        <p class="muted fs-sm sec-lead">{L.cardsLead({ n: num(recap.retired) })}</p>
        <div class="tier-bar" aria-hidden="true">
          {#each bars.filter((b) => b.n > 0) as b (b.tier)}
            <span style="flex-grow: {b.n}; --c-base: {CARD_TIER_SWATCH[b.tier].base}; --c-dark: {CARD_TIER_SWATCH[b.tier].dark}"></span>
          {/each}
        </div>
        <ul class="tier-legend">
          {#each bars as b (b.tier)}
            <li class:none={b.n === 0} data-recap-card-tier={b.tier}>
              <i style="--c-base: {CARD_TIER_SWATCH[b.tier].base}; --c-line: {CARD_TIER_SWATCH[b.tier].line}"></i>
              <span>{b.label}</span>
              <b class="num">{L.tierCount({ n: b.n })}</b>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <section class="card recap-sec" data-recap-section="team" aria-label={L.secTeam}>
      <h2>{L.secTeam}</h2>
      {#if recap.team}
        {@const t = recap.team}
        {@const sum = recapTeamSummary(t)}
        <div class="team-head">
          <b class="team-name">{t.name}</b>
          <span class="muted fs-sm num">{L.played({ n: num(sum.played) })}</span>
        </div>
        {#if sum.played > 0}
          <div class="wdl" aria-hidden="true">
            {#if t.wins}<span class="w" style="flex-grow: {t.wins}">{t.wins}</span>{/if}
            {#if t.draws}<span class="d" style="flex-grow: {t.draws}">{t.draws}</span>{/if}
            {#if t.losses}<span class="l" style="flex-grow: {t.losses}">{t.losses}</span>{/if}
          </div>
        {/if}
        <dl class="recap-stats three">
          {@render stat(O.statRecord, recordText({ w: t.wins, d: t.draws, l: t.losses }), 'record')}
          {@render stat(L.winRate, `${sum.winRate}%`, 'win-rate')}
          {@render stat(L.rating, num(t.rating), 'rating')}
          {@render stat(L.goals, num(t.goalsFor), 'goals')}
          {#if t.goalsAgainst !== null}{@render stat(L.goalsAgainst, num(t.goalsAgainst), 'goals-against')}{/if}
          {#if sum.goalDiff !== null}{@render stat(L.goalDiff, signed(sum.goalDiff), 'goal-diff')}{/if}
          {@render stat(L.bestStreak, num(t.bestStreak), 'streak')}
          {#if t.bestMargin}{@render stat(L.bestMargin, L.marginGoals({ n: t.bestMargin }), 'best-margin')}{/if}
        </dl>
      {:else}
        <p class="muted fs-sm">{L.noTeam}</p>
      {/if}
    </section>

    {#if ranks.length > 0}
      <section class="card recap-sec" data-recap-section="ranks" aria-label={L.secRanks}>
        <h2>{L.secRanks}</h2>
        <ul class="rank-list">
          {#each ranks as r (r.key)}
            <li data-recap-rank={r.key}>
              <div class="rank-row">
                <span>{r.label}</span>
                <b class="num">{rankText(r.rank, r.total)}</b>
                {#if r.pct !== null}<em class:hot={r.hot}>{L.topPct({ pct: r.pct })}</em>{/if}
              </div>
              <div class="rank-meter" aria-hidden="true"><span style="width: {r.meter}%"></span></div>
            </li>
          {/each}
        </ul>
        {#if recap.achievements}<p class="muted fs-sm">{L.achScore} {num(recap.achievements.score)} · {L.achDone({ n: recap.achievements.done })}</p>{/if}
      </section>
    {/if}

    <section class="card recap-sec" data-recap-section="honors" aria-label={L.secBadges}>
      <h2>{L.secBadges}</h2>
      {#if honors.length === 0}
        <p class="muted fs-sm">{L.honorsNone}</p>
      {:else}
        <ul class="recap-honors">
          {#each honors as h (h.kind)}
            <li class="recap-honor medal {h.medal}" data-recap-honor={h.kind}>
              <span class="recap-emblem"><HonorEmblem {h} /></span>
              <span class="recap-honor-text">
                <b>{h.title}</b>
                <span class="recap-honor-detail num">{h.detail}</span>
              </span>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <section class="card recap-sec" data-recap-section="activity" aria-label={L.secLegacy}>
      <h2>{L.secLegacy}</h2>
      <dl class="recap-stats">
        {@render stat(L.retiredNumbers, num(recap.retiredNumbers), 'retired-numbers')}
        {@render stat(L.wallOfHonor, num(recap.wallOfHonor), 'wall-of-honor')}
        {@render stat(L.firsts, num(recap.firsts), 'firsts')}
        {#if recap.stats}{@render stat(L.numAssists, num(recap.stats.assists), 'assists')}{/if}
      </dl>
    </section>

    <div class="recap-end">
      {@render shareButton('end')}
      <p class="muted fs-sm recap-next" data-recap-next>{L.next({ season: teamSeasonLabel(res.season + 1) })}</p>
    </div>

    {#if sharing}
      <ShareSheet
        make={makeShare}
        onclose={() => (sharing = false)}
        act="recap-share"
        alt={L.shareAlt({ season: name })}
        shareText={`${L.shareText({ season: name })} · offside-lab.com`}
        text={{ title: L.shareBtn, lead: L.shareLead, close: L.shareClose, making: L.shareMaking, makeFail: L.shareFail, openFail: L.shareOpenFail, save: L.shareSave, share: L.shareNow, remake: L.shareRemake, makingBtn: L.shareMaking }}
      />
    {/if}
  {/if}

  <BackBar act="owner" fallback={() => go('owner')} />
</div>

<style>
  /* 시즌 카드 — 테마와 상관없이 어두운 바탕(공유 이미지와 같은 첫인상). 등급 색 빛이 가운데서 번진다. */
  .recap-hero {
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 18px 18px 20px;
    border-radius: 20px;
    color: #eef4ef;
    text-align: center;
    background:
      radial-gradient(ellipse 80% 60% at 50% 34%, color-mix(in srgb, var(--tier) 55%, transparent), transparent 70%),
      repeating-linear-gradient(-55deg, #ffffff07 0 14px, transparent 14px 48px),
      linear-gradient(180deg, #101a14, #0a110d);
    box-shadow: var(--shadow);
    isolation: isolate;
  }
  .hero-top {
    align-self: stretch;
    display: flex;
    justify-content: space-between;
    font-family: var(--display);
    font-weight: 700;
    letter-spacing: 0.06em;
  }
  .hero-brand { color: #f0b437; font-size: 1.125rem; }
  .hero-eyebrow { color: #9fb0a5; font-size: 0.875rem; align-self: center; }
  .hero-season {
    margin: 4px 0 0;
    font-size: clamp(1.75rem, 8vw, 2.5rem);
    font-weight: 800;
    letter-spacing: -0.01em;
    line-height: 1.1;
    animation: rise 0.6s ease-out both;
  }
  .hero-emblem {
    margin: 6px 0 2px;
    animation: pop 0.7s cubic-bezier(0.2, 1.4, 0.4, 1) 0.15s both;
  }
  .hero-tier {
    font-family: var(--display);
    font-size: 1.5rem;
    letter-spacing: 0.02em;
    color: var(--tier-light);
  }
  .hero-reason { font-size: 0.8125rem; color: #9fb0a5; }
  .hero-headline {
    margin: 8px 0 2px;
    max-width: 30ch;
    font-size: 1.0625rem;
    font-weight: 700;
    line-height: 1.5;
    text-wrap: balance;
  }
  .hero-pills {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px;
    margin: 6px 0 4px;
    padding: 0;
    list-style: none;
  }
  .hero-pills li {
    padding: 5px 12px;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--tier-light) 55%, transparent);
    background: color-mix(in srgb, var(--tier) 22%, transparent);
    color: var(--tier-mark);
    font-size: 0.8125rem;
    font-weight: 700;
    animation: rise 0.5s ease-out both;
    animation-delay: calc(0.35s + var(--i) * 0.07s);
  }
  .recap-share-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 44px;
    margin-top: 8px;
    padding: 0 20px;
  }
  .recap-hero .recap-share-btn {
    background: #f0b437;
    border-color: #f0b437;
    color: #231700;
    box-shadow: 0 6px 18px -8px #f0b437aa;
  }
  .recap-share-btn svg {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .sec-lead { margin: -6px 0 0; }

  /* 숫자로 본 시즌 — 큰 숫자 세 칸씩. 골 · 발롱도르 칸은 금색. */
  .big-numbers {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    margin: 0;
  }
  .big-numbers div {
    display: flex;
    flex-direction: column-reverse;
    align-items: center;
    gap: 2px;
    padding: 12px 6px 10px;
    border-radius: 14px;
    background: var(--surface-2);
    min-width: 0;
  }
  .big-numbers dt { font-size: 0.75rem; color: var(--muted); }
  .big-numbers dd {
    margin: 0;
    font-family: var(--display);
    font-size: clamp(1.5rem, 7vw, 2rem);
    font-weight: 700;
    line-height: 1.05;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }
  .big-numbers .lead {
    background: color-mix(in srgb, var(--accent) 14%, var(--surface-2));
  }
  .big-numbers .lead dd { color: var(--accent-text); }

  /* 이 시즌의 얼굴 — 대표 선수는 카드 등급 색, 최다 득점 선수는 큰 골 수. */
  .faces {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 8px;
  }
  .face {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    min-height: 44px;
    min-width: 0;
    padding: 14px;
    border-radius: 14px;
    border: 1px solid var(--line);
    background: var(--surface-2);
  }
  .face-best {
    border: 2px solid var(--c-line);
    background:
      linear-gradient(135deg, transparent 40%, #ffffff22 40.5%, transparent 41%),
      linear-gradient(160deg, var(--c-base), var(--c-dark));
    color: var(--c-ink);
  }
  /* 카드가 있으면 대표 선수는 한 줄을 다 쓰고, 왼쪽에 선수 카드 · 오른쪽에 기록. */
  .face-best.with-card {
    grid-column: 1 / -1;
    flex-direction: row;
    align-items: center;
    gap: 14px;
  }
  .face-card {
    flex: none;
    width: 148px;
    animation: pop 0.7s cubic-bezier(0.2, 1.4, 0.4, 1) both;
  }
  .face-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .face-eyebrow { font-size: 0.75rem; font-weight: 600; opacity: 0.8; }
  .face-name { font-size: 1.125rem; line-height: 1.3; overflow-wrap: anywhere; }
  .face-sub { font-size: 0.8125rem; opacity: 0.8; overflow-wrap: anywhere; }
  .face-score { margin-top: 6px; font-family: var(--display); font-size: 1.125rem; font-weight: 700; }
  .face-peak { font-family: var(--display); font-size: 0.9375rem; font-weight: 700; opacity: 0.85; }
  .face-goals {
    display: flex;
    align-items: baseline;
    gap: 4px;
    margin-top: auto;
    padding-top: 6px;
    font-family: var(--display);
    font-size: 2.25rem;
    font-weight: 700;
    line-height: 1;
    color: var(--accent-text);
  }
  .face-goals small { font-family: var(--body); font-size: 0.8125rem; color: var(--muted); }

  /* 카드 등급 — 한 줄 막대와 범례. */
  .tier-bar {
    display: flex;
    gap: 2px;
    height: 18px;
    border-radius: 9px;
    overflow: hidden;
  }
  .tier-bar span {
    flex-basis: 0;
    min-width: 6px;
    background: linear-gradient(180deg, var(--c-base), var(--c-dark));
    transform-origin: left;
    animation: grow 0.8s ease-out both;
  }
  .tier-legend {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px 10px;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 0.8125rem;
  }
  .tier-legend li { display: flex; align-items: center; gap: 6px; min-width: 0; }
  .tier-legend li.none { opacity: 0.45; }
  .tier-legend i {
    flex: none;
    width: 12px;
    height: 12px;
    border-radius: 3px;
    background: var(--c-base);
    border: 1px solid var(--c-line);
  }
  .tier-legend b { margin-left: auto; font-family: var(--display); font-size: 0.9375rem; }

  /* 팀 — 승 · 무 · 패 비율 막대. */
  .team-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
  .team-name { font-size: 1.0625rem; overflow-wrap: anywhere; }
  .wdl {
    display: flex;
    gap: 2px;
    height: 26px;
    border-radius: 8px;
    overflow: hidden;
    font-family: var(--display);
    font-size: 0.875rem;
    font-weight: 700;
  }
  .wdl span {
    display: grid;
    place-items: center;
    flex-basis: 0;
    min-width: 22px;
    color: #fff;
    transform-origin: left;
    animation: grow 0.8s ease-out both;
  }
  .wdl .w { background: var(--good); }
  .wdl .d { background: color-mix(in srgb, var(--muted) 70%, var(--surface)); }
  .wdl .l { background: var(--bad); }
  .recap-stats.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }

  /* 시즌 순위 — 상위 몇 %인지 막대로. */
  .rank-list { display: flex; flex-direction: column; gap: 12px; margin: 0; padding: 0; list-style: none; }
  .rank-row { display: flex; align-items: baseline; gap: 8px; font-size: 0.875rem; }
  .rank-row b { margin-left: auto; font-family: var(--display); font-size: 1.0625rem; }
  .rank-row em {
    font-style: normal;
    font-size: 0.75rem;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--surface-2);
    color: var(--muted);
  }
  .rank-row em.hot { background: color-mix(in srgb, var(--accent) 18%, var(--surface)); color: var(--accent-text); }
  .rank-meter { height: 6px; margin-top: 6px; border-radius: 3px; background: var(--surface-2); overflow: hidden; }
  .rank-meter span {
    display: block;
    height: 100%;
    border-radius: 3px;
    background: linear-gradient(90deg, color-mix(in srgb, var(--accent) 55%, var(--surface)), var(--accent));
    transform-origin: left;
    animation: grow 0.9s ease-out 0.1s both;
  }

  .recap-end { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 4px 0 8px; }

  @keyframes rise { from { opacity: 0; transform: translateY(8px); } }
  @keyframes pop { from { opacity: 0; transform: scale(0.6) rotate(-8deg); } }
  @keyframes grow { from { transform: scaleX(0); } }
  @media (max-width: 380px) {
    .big-numbers, .recap-stats.three, .tier-legend { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (prefers-reduced-motion: reduce) {
    .hero-season, .hero-emblem, .face-card, .hero-pills li, .tier-bar span, .wdl span, .rank-meter span { animation: none; }
  }
</style>
