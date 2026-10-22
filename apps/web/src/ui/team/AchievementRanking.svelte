<script lang="ts">
  import Skeleton from '../Skeleton.svelte';
  import { seasonLabel } from '@offside/app-core/seasonName';
  import TeamLogo from './TeamLogo.svelte';
  // T-11-028 구단주 랭킹 — 기록실 탭. 구단주의 시즌 업적 점수 순(같은 점수면 먼저 닿은 구단주가 앞선다). 구단주는 공개
  // 닉네임과 그 시즌 팀 이름으로만 보이고, 팀이 있으면 줄을 눌러 팀 프로필을 연다. 서버가 5분마다 새로 센다.
  import { ACH_GRADES, ACH_RANK_PER_PAGE, achGradeOf } from '@offside/contracts/owner-team';
  import { displaySeasonAt, openTeamSeasons, teamSeasonName } from '@offside/contracts/service-seasons';
  import { fetchAchRanking, fetchMyAchRank, type AchRankResponse } from '@offside/app-core/api/team';
  import { canJumpToMyRank, myRankJump } from '@offside/app-core/myRank';
  import { isMember } from '@offside/app-core/account';
  import { accountCache } from '../account-state.svelte.js';
  import { toast } from '../helpers.js';
  import { tick } from 'svelte';
  import { hofStart } from '@offside/app-core/state';
  import { num as n } from '@offside/app-core/teamText';
  import { achGradeName } from '@offside/app-core/teamOwner';
  import { teamAchText as L } from '@offside/app-core/i18n/ko/teamAch';
  import { seasonNow } from '../seasonNow.svelte.js';
  import { appState } from '../state.svelte.js';
  import TitleBadge from '../cup/TitleBadge.svelte';
  import AchGradeBadge from './AchGradeBadge.svelte';
  import GradeEmblem from './GradeEmblem.svelte';

  const PREVIEW_KEY = 'offside:achievement-grade-preview';
  const canPreview = import.meta.env.DEV && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  let preview = $state(canPreview && sessionStorage.getItem(PREVIEW_KEY) === '1');
  /** undefined = 지금 시즌(서버가 정한다). */
  let season = $state<number | undefined>(undefined);
  let page = $state(1);
  let data = $state<AchRankResponse | null>(null);
  let failed = $state(false);
  let loading = $state(true);
  const clock = seasonNow();
  const now = $derived(clock.now);
  const seasons = $derived(data?.seasons ?? openTeamSeasons(now).map((id) => ({ id, name: teamSeasonName(id) })));
  const selectedSeason = $derived(season ?? data?.season ?? displaySeasonAt(now));
  /** 다시 받을 기준 — 고른 시즌, 아니면 지금 시즌(띄운 채 개막을 넘기면 바뀐다). */
  const shownSeason = $derived(season ?? displaySeasonAt(now));

  // T-11-441 '내 순위로'(팀 랭킹과 같다). 내 줄은 순위로 강조한다.
  // 로그인 상태를 아직 묻지 않았으면(구단주 화면을 열지 않음) 버튼을 두고, 누를 때 서버가 판정한다(따로 묻지 않는다).
  const member = $derived.by(() => {
    const a = accountCache.value;
    return a === undefined || (!!a && a !== 'error' && isMember(a));
  });
  /** 내 줄(시즌과 순위). 다른 시즌을 고르면 강조하지 않는다. */
  let mine = $state<{ season: number; rank: number } | null>(null);
  let jumping = $state(false);
  let preset: AchRankResponse | null = null;
  async function jumpToMe() {
    jumping = true;
    const j = myRankJump(await fetchMyAchRank(season), 'ach');
    jumping = false;
    if (!j.ok) return toast(j.message);
    mine = { season: j.data.season, rank: j.rank };
    if (j.data.page !== page) preset = j.data;
    data = j.data;
    page = j.data.page;
    await tick();
    document.querySelector(`[data-ach-rank="${j.rank}"]`)?.scrollIntoView({ block: 'center' });
  }

  $effect(() => {
    const [se, p, example] = [season, page, preview];
    void shownSeason;
    if (preset && preset.page === p && !example) {
      preset = null;
      loading = false;
      failed = false;
      return;
    }
    preset = null;
    let live = true;
    failed = false;
    loading = true;
    if (example) {
      // 화면에서만 쓰는 예시. 서버·DB·실제 랭킹에는 넣지 않는다.
      data = {
        season: se ?? displaySeasonAt(now),
        seasons: openTeamSeasons(now).map((id) => ({ id, name: teamSeasonName(id) })),
        page: 1,
        total: ACH_GRADES.length,
        items: [...ACH_GRADES].reverse().map((grade, i) => ({
          rank: i + 1,
          nickname: `테스트 구단주 ${i + 1}`,
          team: null,
          score: grade.min,
          done: Math.round(grade.min / 50),
          players: Math.ceil(grade.min / 250),
        })),
      };
      loading = false;
      return;
    }
    void fetchAchRanking(se, p).then((r) => {
      if (!live || se !== season || p !== page) return;
      loading = false;
      if (r.ok) data = r.data;
      else failed = true;
    });
    return () => { live = false; };
  });

  const pages = $derived(data ? Math.max(1, Math.ceil(data.total / ACH_RANK_PER_PAGE)) : 1);
  function goPage(p: number) {
    page = p;
    window.scrollTo(0, 0);
  }
  function openTeam(id: string) {
    appState.hof = { ...hofStart(), tab: 'teams', team: id };
    window.scrollTo(0, 0);
  }
  function togglePreview() {
    if (!canPreview) return;
    preview = !preview;
    page = 1;
    if (preview) sessionStorage.setItem(PREVIEW_KEY, '1');
    else sessionStorage.removeItem(PREVIEW_KEY);
  }
</script>

<section class="card" data-ach-ranking>
  {#if canPreview}
    <div class="achievement-preview">
      {#if preview}<span class="muted">예시 데이터 · 7개 등급</span>{/if}
      <button class="hof-sort" data-ach-preview-toggle aria-pressed={preview} onclick={togglePreview}>{preview ? '실제 랭킹 보기' : '뱃지 미리보기'}</button>
    </div>
  {/if}
  <div class="hof-toolbar achievement-toolbar">
    <label class="hof-season-picker">
      <span class="hof-filter-label">{L.seasonLabel}</span>
      <select aria-label={L.rankSeasonAria} data-ach-season-select value={String(selectedSeason)} onchange={(e) => ((season = Number(e.currentTarget.value)), (page = 1))}>
        {#each seasons as s (s.id)}<option value={String(s.id)}>{seasonLabel(s.id, s.name)}</option>{/each}
      </select>
    </label>
    {#if data && !loading && !failed}<span class="achievement-total muted">{L.ownersBefore}<b class="num">{n(data.total)}</b>{L.ownersAfter}</span>{/if}
  </div>
  {#if canJumpToMyRank(member) && !preview}
    <button class="btn btn-sm rank-jump" data-act="my-rank" disabled={jumping} onclick={() => void jumpToMe()}>{L.myRank}</button>
  {/if}
  {#if failed}
    <p class="empty">{L.rankFail}</p>
  {:else if loading || !data}
    <Skeleton rows={6} />
  {:else if data.items.length}
    <div class="achievement-columns achievement-header" aria-hidden="true">
      <span class="achievement-heading">{L.hdrOwner}</span><span>{L.hdrGrade}</span><span title={L.hdrDoneTitle}>{L.hdrDone}</span><b>{L.hdrScore}</b>
    </div>
    <ol class="achievement-list" start={data.items[0]!.rank} aria-label={L.ownerListAria}>
      {#each data.items as r (r.rank)}
        {@const grade = achGradeOf(r.score).grade}
        {@const name = r.nickname ?? L.anonOwner}
        {@const gradeName = achGradeName(grade)}
        {@const label = L.rowAria({ rank: r.rank, name, grade: gradeName, done: n(r.done), score: n(r.score) })}
        {#snippet row()}
          <span class="achievement-owner">
            <span class="achievement-rank num">{r.rank}</span>
            {#if r.team}<TeamLogo logo={r.team.logo} name={r.team.name} size={24} decorative />{/if}
            <span class="achievement-identity"><b title={name}>{name}{#if r.title} <TitleBadge title={r.title} size="icon" />{/if}</b><small class="muted" title={r.team?.name}>{r.team?.name ?? L.noTeam}</small></span>
          </span>
          <span class="achievement-grade" data-ach-grade={grade.id} role="img" aria-label={gradeName} title={gradeName}><GradeEmblem id={grade.id} size={32} /></span>
          <span class="num achievement-done" title={L.doneTitle({ n: n(r.done) })}>{n(r.done)}</span>
          <strong class="num achievement-score" title={L.scoreTitle({ n: n(r.score) })}>{n(r.score)}</strong>
        {/snippet}
        {@const isMine = !!mine && mine.season === data.season && mine.rank === r.rank}
        <li value={r.rank} class:mine={isMine} aria-current={isMine ? 'true' : undefined}>
          {#if r.team}
            <button class="achievement-columns achievement-row" data-ach-rank={r.rank} aria-label={L.rowAriaTeam({ label })} onclick={() => r.team && openTeam(r.team.id)}>{@render row()}</button>
          {:else}
            <div class="achievement-columns achievement-row" data-ach-rank={r.rank} role="group" aria-label={label}>{@render row()}</div>
          {/if}
        </li>
      {/each}
    </ol>
    {#if pages > 1}
      <nav class="hof-pager" aria-label={L.pagerAria}>
        <button class="icon-btn" data-ach-page="prev" disabled={page <= 1} onclick={() => goPage(page - 1)}>{L.prev}</button>
        <span class="num" aria-live="polite">{page} / {pages}</span>
        <button class="icon-btn" data-ach-page="next" disabled={page >= pages} onclick={() => goPage(page + 1)}>{L.next}</button>
      </nav>
    {/if}
  {:else}
    <p class="empty">{L.ownersEmpty}</p>
  {/if}
  <div class="achievement-notes">
    <details class="ach-grades">
      <summary class="muted fs-sm">{L.gradesTitle}</summary>
      <ul>
        {#each ACH_GRADES as g (g.id)}
          <li><AchGradeBadge grade={g} /><span class="num muted">{L.gradeFrom({ n: n(g.min) })}</span></li>
        {/each}
      </ul>
    </details>
    <p class="muted">{L.noteReset}</p>
    <p class="muted">{L.noteSum}</p>
  </div>
</section>

<style>
  /* T-11-441 내 줄 */
  .achievement-list > li.mine {
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    border-radius: 8px;
  }
  .rank-jump {
    margin: 0 0 12px;
  }
  .achievement-preview {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 6px 10px;
    margin-bottom: 12px;
    font-size: 12px;
  }
  .achievement-preview > span {
    margin-right: auto;
  }
  .achievement-toolbar {
    margin-bottom: 12px;
  }
  .achievement-total {
    text-align: right;
    padding-bottom: 10px;
    font-size: 12px;
  }
  .achievement-total b {
    color: var(--ink);
    font-size: 16px;
  }
  .achievement-columns {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 40px 32px 50px;
    align-items: center;
    gap: 4px;
    text-align: center;
  }
  .achievement-header {
    min-height: 36px;
    border-bottom: 1px solid var(--line);
    color: var(--muted);
    font-size: 12px;
  }
  .achievement-heading {
    padding-left: 26px;
    text-align: left;
  }
  .achievement-header b {
    color: var(--ink);
    font-weight: 600;
  }
  .achievement-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .achievement-list > li + li {
    border-top: 1px solid var(--line);
  }
  .achievement-row {
    width: 100%;
    min-height: 60px;
    padding: 8px 0;
    border: 0;
    border-radius: 0;
    background: none;
    font-size: 14px;
  }
  button.achievement-row:active {
    background: color-mix(in srgb, var(--ink) 7%, transparent);
  }
  .achievement-owner {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    text-align: left;
  }
  .achievement-rank {
    flex: 0 0 20px;
    color: var(--muted);
    text-align: center;
    font-size: 13px;
  }
  .achievement-identity {
    display: grid;
    gap: 2px;
    min-width: 0;
  }
  .achievement-identity b,
  .achievement-identity small {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .achievement-identity b {
    font-weight: 600;
  }
  .achievement-identity small {
    font-size: 12px;
    line-height: 1.5;
  }
  .achievement-grade {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-width: 0;
    min-height: 40px;
  }
  .achievement-done,
  .achievement-score {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .achievement-score {
    font-size: 18px;
    font-weight: 700;
  }
  .achievement-notes {
    margin-top: 16px;
    padding-top: 4px;
    border-top: 1px solid var(--line);
  }
  .achievement-notes .ach-grades {
    margin-top: 0;
  }
  .achievement-notes summary {
    min-height: 44px;
    padding: 12px 0;
  }
  .achievement-notes p {
    margin: 4px 0 0;
    font-size: 12px;
    line-height: 1.6;
  }
  @media (min-width: 400px) {
    .achievement-columns {
      grid-template-columns: minmax(0, 1fr) 48px 44px 60px;
      gap: 6px;
    }
  }
</style>
