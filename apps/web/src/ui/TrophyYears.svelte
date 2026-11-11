<script lang="ts">
  // T-11-695 같은 해에 받은 우승 · 수상을 한 묶음으로. 연도는 묶음 왼쪽에 한 번만 적고(여럿이면 ×개수), 오른쪽에 그해 것을
  // 쌓는다. 구단 이름은 바로 앞 줄과 같으면 다시 적지 않는다. 트로피 탭(진행 중)과 은퇴 화면이 같이 쓴다.
  import { groupByYear } from '@offside/app-core/trophyYears';
  import { careerTrophy } from '@offside/app-core/career-trophy';
  import { compOfTrophy } from '@offside/app-core/compEmblem';
  import { tn } from '@offside/game/i18n/names';
  import CareerTrophy from './CareerTrophy.svelte';
  import ClubMark from './ClubMark.svelte';
  import CompIcon from './CompIcon.svelte';

  type Item = { year: number; t: string; club?: string; clubId?: string | undefined };
  let { items, icons = true, still = false }: { items: readonly Item[]; icons?: boolean; still?: boolean } = $props();
  const groups = $derived(groupByYear(items));
</script>

{#each groups as g (g.year)}
  <div class="trophy ty-group" data-trophy-year={g.year}>
    <span class="y">{g.year}{#if g.items.length > 1}<small class="ty-n" aria-hidden="true">×{g.items.length}</small>{/if}</span>
    <ul class="ty-items">
      {#each g.items as x, i (i)}
        {@const comp = icons ? compOfTrophy(x.t) : null}
        <li class="ty-item" class:ty-plain={!icons}>
          {#if icons}{#if comp}<CompIcon ko={comp} size={30} {still} />{:else}<CareerTrophy art={careerTrophy(x.t)} size={30} />{/if}{/if}
          <div>
            <b>{tn(x.t)}</b>
            {#if x.club && (i === 0 || g.items[i - 1]!.club !== x.club)}<span class="muted fs-xs"><ClubMark name={x.club} id={x.clubId} size={14} /> {tn(x.club)}</span>{/if}
          </div>
        </li>
      {/each}
    </ul>
  </div>
{/each}

<style>
  .ty-group {align-items:start;}
  .ty-group .y {display:flex; flex-direction:column; line-height:1.15; padding-top:5px;}
  .ty-n {font-family:var(--display); font-size:var(--fs-caption, 12px); font-weight:600; color:var(--accent); letter-spacing:0.02em;}
  .ty-items {display:flex; flex-direction:column; gap:10px; margin:0; padding:0; list-style:none; min-width:0;}
  .ty-item {display:grid; grid-template-columns:auto 1fr; gap:10px; align-items:center; min-width:0;}
  .ty-item.ty-plain {grid-template-columns:1fr;}
  .ty-item > div {min-width:0;}
  .ty-item b {overflow-wrap:anywhere;}
</style>
