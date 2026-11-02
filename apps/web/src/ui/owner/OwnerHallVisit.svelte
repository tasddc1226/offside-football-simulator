<script lang="ts">
  // T-11-618 남의 명예관의 칭호 칸 — 받은 칭호만 묶음별로 보여 준다(고르기 · 진행도는 내 명예관에만 있다).
  import { titleLabel, titleCondition, permanentTitleOf, titleGradeLabel, titleCategoryLabel } from '@offside/app-core/ownerTitle';
  import { titleGroups, titleTierText } from '@offside/app-core/ownerTitleCollection';
  import { ownerProfileText as L } from '@offside/app-core/i18n/ko/ownerProfile';
  import TitleBadge from '../cup/TitleBadge.svelte';

  const { title, titles }: { title: string | null; titles: readonly string[] } = $props();
  const groups = $derived(titleGroups({ titles: [...titles], permanent: [] }).earned);
</script>

<div class="visit-titles" data-owner-hall-visit>
  {#each groups as g (g.key)}
    <section class="visit-group" data-title-group={g.key}>
      <h3>{titleCategoryLabel(g.key)}<span>{g.ids.length}</span></h3>
      {#each g.ids as id (id)}
        {@const def = permanentTitleOf(id)}
        <div class="visit-item" class:using={title === id} data-visit-title={id}>
          <div class="visit-head">
            <span aria-hidden="true"><TitleBadge title={id} size="icon" /></span>
            <strong>{titleLabel(id)}</strong>
            <small class="muted">{def ? titleGradeLabel(def.grade) : L.titleCup}{#if titleTierText(id)} · {titleTierText(id)}{/if}</small>
            {#if title === id}<small class="visit-using">✓ {L.titleUsing}</small>{/if}
          </div>
          {#if def}<p class="muted fs-sm">{titleCondition(id)}</p>{/if}
        </div>
      {/each}
    </section>
  {:else}<p class="muted">{L.visitNoTitles}</p>{/each}
</div>

<style>
  .visit-titles,.visit-group{display:flex;flex-direction:column;gap:10px;}
  .visit-titles{gap:18px;}
  h3{margin:0;font-size:15px;display:flex;gap:6px;align-items:baseline;}
  h3 span{color:var(--muted);font-size:13px;font-weight:500;}
  .visit-item{border:1px solid var(--line);border-radius:var(--radius-md);padding:12px;display:flex;flex-direction:column;gap:6px;}
  .visit-item.using{border-color:var(--accent);}
  .visit-head{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;}
  .visit-head small{font-size:12px;}
  .visit-using{color:var(--accent-text);}
  p{margin:0;}
</style>
