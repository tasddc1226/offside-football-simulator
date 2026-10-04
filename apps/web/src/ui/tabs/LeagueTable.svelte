<script lang="ts">
  // T-10-024: 선수가 뛰는 리그의 순위표. 기본은 상위 3팀 + 내 팀 앞뒤 2팀 + 꼴찌만 접어서 보여 주고,
  // '전체 순위'로 모두 펼친다. T-11-025 시즌 탭의 시즌 현황 카드 안에 들어가는 한 묶음이라 카드 테두리 없이 작은 제목을 단다. 칸은 순위·팀·경기·승점만(승·무·패는 리포트·시즌 누적 줄에 있다).
  import { leagueOf, leagueTable, seasonLeagueId } from '@offside/game/engine';
  import type { GameState } from '@offside/game/types';
  import ClubBadge from '../ClubBadge.svelte';
  import { RANK_SLIDE_MS, rankSlideSpan } from '@offside/app-core/resultTour';
  import { dur } from '../motion.js';

  const { s }: { s: GameState } = $props();
  let full = $state(false);

  const rows = $derived(leagueTable(s));
  const myRank = $derived(rows.findIndex((r) => r.me) + 1);
  const keep = (rank: number) => rank <= 3 || Math.abs(rank - myRank) <= 2 || rank === rows.length;
  // 접힌 구간은 '⋯' 줄 하나로 표시한다.
  const shown = $derived.by(() => {
    const out: ({ gap: true; key: string } | { gap: false; key: string; rank: number; r: (typeof rows)[number] })[] = [];
    rows.forEach((r, i) => {
      const rank = i + 1;
      if (full || keep(rank)) out.push({ gap: false, key: `row-${rank}`, rank, r }); // 구단 이름은 유저가 겹치게 바꿀 수 있다(T-10-034).
      else if (!out.at(-1)?.gap) out.push({ gap: true, key: `gap-${rank}` });
    });
    return out;
  });
  const folded = $derived(shown.some((x) => x.gap));

  let tbody = $state<HTMLTableSectionElement>();
  /** T-11-025 순위 변동 연출: 내 팀 줄이 이전 순위 자리에서 지금 자리로 미끄러지고, 그사이 지나친 줄들은 한 칸씩 반대로
   * 밀려난다(범위는 app-core rankSlideSpan, 줄 칸을 Web Animations로 옮긴다). 순위 칸 옆에 ▲/▼ 변동 폭을 잠깐 단다.
   * 시즌 탭 결과 안내 스크롤이 순위표를 비출 때 부른다. */
  export function playRank(before: number | null) {
    if (!tbody || !before || !dur(1)) return;
    const trs = [...tbody.rows];
    const span = rankSlideSpan(
      trs.map((tr) => (tr.dataset.rank ? { rank: Number(tr.dataset.rank), me: 'me' in tr.dataset } : {})),
      before,
      myRank,
    );
    if (!span) return;
    const { me, from, up } = span;
    const top = (i: number) => trs[i]!.getBoundingClientRect().top;
    const h = trs[me]!.getBoundingClientRect().height;
    const opts = { duration: dur(RANK_SLIDE_MS), easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' };
    const slide = (tr: HTMLTableRowElement, dy: number) =>
      [...tr.cells].map((td) => td.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], opts));
    for (let i = Math.min(me, from); i <= Math.max(me, from); i++) if (i !== me) slide(trs[i]!, up ? -h : h);
    const mine = trs[me]!;
    const cell = mine.cells[0]!;
    mine.classList.add('lt-moving');
    cell.dataset.delta = `${up ? '▲' : '▼'}${Math.abs(before - myRank)}`;
    cell.dataset.dir = up ? 'up' : 'down';
    void slide(mine, top(from) - top(me))[0]?.finished.finally(() => {
      mine.classList.remove('lt-moving');
      setTimeout(() => {
        delete cell.dataset.delta;
        delete cell.dataset.dir;
      }, 2400);
    });
  }
</script>

<div class="league-table" data-league-table>
  <div class="row" style="justify-content:space-between;align-items:baseline">
    <h3 class="sub-title">{leagueOf(seasonLeagueId(s)).name} 순위</h3>
    {#if s.season.played && (folded || full)}
      <button class="icon-btn" data-act="table-toggle" aria-expanded={full} onclick={() => (full = !full)}>{full ? '접기' : '전체 순위'}</button>
    {/if}
  </div>
  {#if s.season.played}
    <table>
      <thead>
        <tr><th scope="col">#</th><th scope="col" class="lt-team">팀</th><th scope="col">경기</th><th scope="col">승점</th></tr>
      </thead>
      <tbody bind:this={tbody}>
        {#each shown as x (x.key)}
          {#if x.gap}
            <tr class="lt-gap" aria-hidden="true"><td colspan="4">⋯</td></tr>
          {:else}
            <tr class:me={x.r.me} class:top={x.rank === 1} aria-current={x.r.me ? 'true' : undefined} data-rank={x.rank} data-me={x.r.me || undefined}>
              <td class="num">{x.rank}</td>
              <td class="lt-team">{#if x.r.id}<ClubBadge club={{ id: x.r.id, name: x.r.name }} size={16} /> {/if}{x.r.name}</td>
              <td class="num">{x.r.p}</td>
              <td class="num lt-pts">{x.r.pts}</td>
            </tr>
          {/if}
        {/each}
      </tbody>
    </table>
  {:else}
    <p class="muted fs-sm">개막하면 {rows.length}개 팀 순위표가 채워져요.</p>
  {/if}
</div>
