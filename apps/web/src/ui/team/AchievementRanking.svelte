<script lang="ts">
  // T-11-028 업적 랭킹 — 기록실 탭. 구단주의 시즌 업적 점수 순(같은 점수면 먼저 닿은 구단주가 앞선다). 구단주는 공개
  // 닉네임과 그 시즌 팀 이름으로만 보이고, 팀이 있으면 줄을 눌러 팀 프로필을 연다. 서버가 5분마다 새로 센다.
  import { ACH_GRADES, ACH_RANK_PER_PAGE, achGradeOf } from '@offside/contracts/owner-team';
  import { fetchAchRanking, type AchRankResponse } from '@offside/app-core/api/team';
  import { hofStart } from '@offside/app-core/state';
  import { num as n } from '@offside/app-core/teamText';
  import Laurel from '../Laurel.svelte';
  import { appState } from '../state.svelte.js';
  import AchGradeBadge from './AchGradeBadge.svelte';
  import GradeEmblem from './GradeEmblem.svelte';

  const MEDAL = ['gold', 'silver', 'bronze'];
  /** undefined = 지금 시즌(서버가 정한다). */
  let season = $state<number | undefined>(undefined);
  let page = $state(1);
  let data = $state<AchRankResponse | null>(null);
  let failed = $state(false);

  $effect(() => {
    const [se, p] = [season, page];
    failed = false;
    void fetchAchRanking(se, p).then((r) => {
      if (se !== season || p !== page) return; // 더 늦게 고른 조건의 응답만 쓴다.
      if (r.ok) data = r.data;
      else failed = true;
    });
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
</script>

<section class="card" data-ach-ranking>
  <div class="eyebrow">Achievement ranking</div>
  <h1 style="margin-bottom:8px">업적 랭킹</h1>
  {#if data && data.seasons.length > 1}
    <div class="seg board-tabs hof-seasons" role="group" aria-label="시즌">
      {#each data.seasons as s (s.id)}
        <button class="opt" aria-pressed={data.season === s.id} data-ach-season={s.id} onclick={() => ((season = s.id), (page = 1))}>{s.name}</button>
      {/each}
    </div>
  {/if}
  {#if failed}
    <p class="empty">랭킹을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
  {:else if !data}
    <p class="empty">불러오는 중…</p>
  {:else if data.items.length}
    <p class="muted hof-source">{data.seasons.find((s) => s.id === data?.season)?.name} · 구단주 {n(data.total)}명 · 업적 점수 순</p>
    {#each data.items as r (r.rank)}
      {@const grade = achGradeOf(r.score).grade}
      {#snippet row()}
        {#if r.rank <= MEDAL.length}
          <div class="hof-rank medal {MEDAL[r.rank - 1]}"><Laurel /><span>{r.rank}</span></div>
        {:else}
          <div class="hof-rank">{r.rank}</div>
        {/if}
        <div>
          <b>{r.nickname ?? '익명 구단주'}</b>
          <div class="muted fs-xs">{r.team ? `${r.team.name} · ` : ''}업적 {n(r.done)}개 · 선수 {n(r.players)}명</div>
        </div>
        <div class="ach-rank-value">
          <GradeEmblem id={grade.id} size={34} />
          <div>
            <AchGradeBadge {grade} emblem={false} />
            <span class="num hof-value">{n(r.score)}</span>
          </div>
        </div>
      {/snippet}
      {#if r.team}
        <button class="hof-row" data-ach-rank={r.rank} onclick={() => r.team && openTeam(r.team.id)}>{@render row()}</button>
      {:else}
        <div class="hof-row" data-ach-rank={r.rank}>{@render row()}</div>
      {/if}
    {/each}
    {#if pages > 1}
      <nav class="hof-pager" aria-label="랭킹 페이지">
        <button class="icon-btn" data-ach-page="prev" disabled={page <= 1} onclick={() => goPage(page - 1)}>← 이전</button>
        <span class="num" aria-live="polite">{page} / {pages}</span>
        <button class="icon-btn" data-ach-page="next" disabled={page >= pages} onclick={() => goPage(page + 1)}>다음 →</button>
      </nav>
    {/if}
  {:else}
    <p class="empty">아직 랭킹에 오른 구단주가 없어요. 은퇴한 선수로 시즌 업적을 달성하면 여기에 올라요.</p>
  {/if}
  <details class="ach-grades">
    <summary class="muted fs-sm">등급 기준</summary>
    <ul>
      {#each ACH_GRADES as g (g.id)}
        <li><AchGradeBadge grade={g} /><span class="num muted">{n(g.min)}점부터</span></li>
      {/each}
    </ul>
  </details>
  <p class="muted fs-xs" style="margin-top:10px">시즌마다 처음부터 다시 쌓아요. 선수·팀·구단주 업적 점수의 합이고, 랭킹은 5분마다 새로 세요.</p>
</section>
