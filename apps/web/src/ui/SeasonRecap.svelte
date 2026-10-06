<script lang="ts">
  // T-11-128 구단주 시즌 결산 — 끝난 시즌의 기록(서버가 굳힌 값)과 받은 휘장을 한 화면에 모아 보여 준다.
  // 구단주 화면의 '시즌 결산' 카드로 연다. 열면 그 시즌 결산을 '봤다'고 표시한다(카드의 NEW).
  import Topbar from './Topbar.svelte';
  import BackBar from './BackBar.svelte';
  import HonorEmblem from './HonorEmblem.svelte';
  import GradeEmblem from './team/GradeEmblem.svelte';
  import { go } from './nav.js';
  import { openPublicLegendById } from './legend.js';
  import { fetchOwnerHonors, fetchSeasonRecap, type SeasonRecapResponse } from '@offside/app-core/api/seasonRecap';
  import { honorViews, markRecapSeen, rankText, recapCutoffText, recapStatusText } from '@offside/app-core/seasonRecap';
  import { teamSeasonLabel } from '@offside/app-core/seasonName';
  import { anonName } from '@offside/app-core/format';
  import { num, recordText } from '@offside/app-core/teamText';
  import { seasonRecapText as L } from '@offside/app-core/i18n/ko/seasonRecap';
  import { ownerText as O } from '@offside/app-core/i18n/ko/owner';
  import { recapTier, tierReason, tierTitle } from '@offside/app-core/ownerTier';
  import { EMBLEM_PALETTE } from '@offside/app-core/gradeEmblem';

  let seasons = $state<number[]>([]);
  let season = $state<number | null>(null);
  let res = $state<SeasonRecapResponse | null>(null);
  let failed = $state(false);
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
    if (r.data.status === 'ready') markRecapSeen(r.data.season);
  }
  $effect(() => {
    void load();
  });

  const name = $derived(res ? teamSeasonLabel(res.season) : '');
  const recap = $derived(res?.status === 'ready' ? res.recap : null);
  const honors = $derived(res ? honorViews(res.honors) : []);
  const tier = $derived(recap ? recapTier(recap) : null);
</script>

{#snippet stat(label: string, value: string, key?: string)}
  <div data-recap-stat={key}><dt>{label}</dt><dd>{value}</dd></div>
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
    {#if tier && res}
      <!-- 시즌 등급 — 구단주 랭킹과 같은 업적 등급을 마감 업적 점수로. 프로필 · 댓글 · 채팅에 다음 시즌 내내 붙는다. -->
      <section class="card recap-sec recap-tier" data-recap-section="tier" data-recap-tier={tier} style="--tier: {EMBLEM_PALETTE[tier].base}" aria-label={L.secTier}>
        <h2>{L.secTier}</h2>
        <GradeEmblem id={tier} size={112} />
        <b class="ach-grade large recap-tier-name" data-grade={tier}>{tierTitle({ tier, season: res.season })}</b>
        <span class="muted fs-sm num">{tierReason(recap)}</span>
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

    <section class="card recap-sec" data-recap-section="activity" aria-label={L.secActivity}>
      <h2>{L.secActivity}</h2>
      <dl class="recap-stats">
        {@render stat(L.players, num(recap.players), 'players')}
        {@render stat(L.retired, num(recap.retired), 'retired')}
      </dl>
    </section>

    <section class="card recap-sec" data-recap-section="legacy" aria-label={L.secLegacy}>
      <h2>{L.secLegacy}</h2>
      {#if recap.best}
        {@const b = recap.best}
        {#snippet bestBody()}
          <small class="eyebrow">{L.best}</small>
          <b>{b.name ?? anonName(b.pos, null)}</b>
          {#if b.lastClub}<span class="muted fs-sm">{b.lastClub}</span>{/if}
          <span class="recap-best-score num">{L.bestScore({ score: num(b.score) })}</span>
        {/snippet}
        <!-- 이름을 공개한 선수만 명예의 전당 상세가 있다(앱과 같다). -->
        {#if b.name}
          <button class="recap-best" data-recap-best={b.careerId} onclick={() => void openPublicLegendById(b.careerId)}>{@render bestBody()}</button>
        {:else}
          <div class="recap-best" data-recap-best={b.careerId}>{@render bestBody()}</div>
        {/if}
      {/if}
      <dl class="recap-stats">
        {@render stat(L.hofRank, rankText(recap.hofRank, recap.hofRanked), 'hof')}
        {@render stat(L.retiredNumbers, num(recap.retiredNumbers), 'retired-numbers')}
        {@render stat(L.wallOfHonor, num(recap.wallOfHonor), 'wall-of-honor')}
        {@render stat(L.firsts, num(recap.firsts), 'firsts')}
      </dl>
    </section>

    <section class="card recap-sec" data-recap-section="team" aria-label={L.secTeam}>
      <h2>{L.secTeam}</h2>
      {#if recap.team}
        {@const t = recap.team}
        <b class="recap-team-name">{t.name}</b>
        <dl class="recap-stats">
          {@render stat(L.rating, num(t.rating), 'rating')}
          {@render stat(L.teamRank, rankText(t.rank, t.ranked), 'team-rank')}
          {@render stat(O.statRecord, recordText({ w: t.wins, d: t.draws, l: t.losses }), 'record')}
          {@render stat(L.goals, num(t.goalsFor), 'goals')}
          {@render stat(L.bestStreak, num(t.bestStreak), 'streak')}
        </dl>
      {:else}
        <p class="muted fs-sm">{L.noTeam}</p>
      {/if}
    </section>

    {#if recap.achievements}
      {@const a = recap.achievements}
      <section class="card recap-sec" data-recap-section="achievements" aria-label={L.secAch}>
        <h2>{L.secAch}</h2>
        <dl class="recap-stats">
          {@render stat(L.achScore, num(a.score), 'ach-score')}
          {@render stat(L.achRank, rankText(a.rank, a.ranked), 'ach-rank')}
        </dl>
        <p class="muted fs-sm">{L.achDone({ n: a.done })}</p>
      </section>
    {/if}

    <p class="muted fs-sm recap-next" data-recap-next>{L.next({ season: teamSeasonLabel(res.season + 1) })}</p>
  {/if}

  <BackBar act="owner" fallback={() => go('owner')} />
</div>
