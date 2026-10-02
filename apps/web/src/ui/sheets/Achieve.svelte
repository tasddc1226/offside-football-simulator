<script lang="ts">
  // T-11-034 업적 달성 알림 본문 — 등급 엠블럼(올랐으면 크게, 이전 → 지금), 새 업적과 얻은 점수, 지금 점수·다음 등급까지.
  import type { SheetView } from '@offside/app-core/sheets';
  import GradeEmblem from '../team/GradeEmblem.svelte';

  let { v }: { v: Extract<SheetView, { kind: 'achieve' }> } = $props();
  const n = (x: number) => x.toLocaleString('ko-KR');
</script>

<div class="eyebrow">{v.eyebrow}</div>
<div class="ach-up" class:grade={!!v.from} data-ach-sheet>
  <span class="ach-up-emblem"><GradeEmblem id={v.grade.id} size={v.from ? 96 : 64} /></span>
  <h2>{v.title}</h2>
  {#if v.from}
    <p class="ach-up-from" aria-label="{v.from.name}에서 {v.grade.name}로">
      <GradeEmblem id={v.from.id} size={20} />{v.from.name}<span aria-hidden="true">→</span><GradeEmblem id={v.grade.id} size={20} /><b>{v.grade.name}</b>
    </p>
  {/if}
</div>
<ul class="ach-up-list">
  {#each v.items as it, i (i)}
    <li><span>{it.label}</span><b class="num">+{n(it.gained)}</b></li>
  {/each}
  {#if v.more > 0}<li class="muted"><span>외 {v.more}개</span></li>{/if}
</ul>
<p class="muted fs-sm ach-up-sum">
  <b class="num">+{n(v.gained)}점</b> · 지금 {n(v.score)}점{v.next ? ` · ${v.next}` : ''}
</p>

<style>
  .ach-up {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    text-align: center;
    margin: 4px 0 10px;
  }
  .ach-up h2 {
    margin: 0;
  }
  .ach-up-emblem {
    display: block;
    animation: ach-pop 0.5s cubic-bezier(0.2, 1.4, 0.4, 1) both;
  }
  .ach-up.grade .ach-up-emblem {
    filter: drop-shadow(0 6px 16px color-mix(in srgb, var(--accent) 35%, transparent));
  }
  @keyframes ach-pop {
    from {
      transform: scale(0.6);
      opacity: 0;
    }
  }
  .ach-up-from {
    display: flex;
    align-items: center;
    gap: 4px;
    margin: 0;
    font-size: 0.875rem;
    color: var(--muted);
  }
  .ach-up-from span {
    margin: 0 4px;
  }
  .ach-up-from b {
    color: var(--ink);
  }
  .ach-up-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 6px;
  }
  .ach-up-list li {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 12px;
    border-radius: 10px;
    background: var(--surface-2);
    font-size: 0.875rem;
  }
  .ach-up-sum {
    margin: 8px 0 0;
    text-align: center;
  }
  @media (prefers-reduced-motion: reduce) {
    .ach-up-emblem {
      animation: none;
    }
  }
</style>
