<script lang="ts">
  // T-10-024: 선수가 뛰는 리그의 순위표. 기본은 상위 3팀 + 내 팀 앞뒤 2팀 + 꼴찌만 접어서 보여 주고,
  // '전체 순위'로 모두 펼친다.
  import { leagueOf, leagueTable } from '../../game/engine.js';
  import type { GameState } from '../../game/types.js';

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
</script>

<section class="card league-table" data-league-table>
  <div class="row" style="justify-content:space-between;align-items:baseline">
    <div><div class="eyebrow">League Table</div><h2>{leagueOf(s.leagueId).name} 순위</h2></div>
    {#if s.season.played && (folded || full)}
      <button class="icon-btn" data-act="table-toggle" aria-expanded={full} onclick={() => (full = !full)}>{full ? '접기' : '전체 순위'}</button>
    {/if}
  </div>
  {#if s.season.played}
    <table>
      <thead>
        <tr><th scope="col">#</th><th scope="col" class="lt-team">팀</th><th scope="col">경기</th><th scope="col">승</th><th scope="col">무</th><th scope="col">패</th><th scope="col">승점</th></tr>
      </thead>
      <tbody>
        {#each shown as x (x.key)}
          {#if x.gap}
            <tr class="lt-gap" aria-hidden="true"><td colspan="7">⋯</td></tr>
          {:else}
            <tr class:me={x.r.me} class:top={x.rank === 1} aria-current={x.r.me ? 'true' : undefined}>
              <td class="num">{x.rank}</td>
              <td class="lt-team">{x.r.name}</td>
              <td class="num">{x.r.p}</td>
              <td class="num">{x.r.w}</td>
              <td class="num">{x.r.d}</td>
              <td class="num">{x.r.l}</td>
              <td class="num lt-pts">{x.r.pts}</td>
            </tr>
          {/if}
        {/each}
      </tbody>
    </table>
  {:else}
    <p class="muted" style="font-size:13px">개막하면 {rows.length}개 팀 순위표가 채워져요.</p>
  {/if}
</section>
