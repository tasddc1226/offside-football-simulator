<script lang="ts">
  // T-11-028 시즌 업적 등급 배지(내 팀 업적 요약 · 구단주 랭킹 공용). T-11-033부터 엠블럼 + 등급 이름. 글자색은 style.css .ach-grade[data-grade].
  import type { AchGrade } from '@offside/contracts/owner-team';
  import GradeEmblem from './GradeEmblem.svelte';

  /** emblem=false면 이름만(엠블럼을 옆에 따로 크게 그리는 구단주 랭킹 줄). */
  let { grade, large = false, emblem = true }: { grade: AchGrade; large?: boolean; emblem?: boolean } = $props();
</script>

<span class="ach-grade" class:large data-grade={grade.id}>{#if emblem}<GradeEmblem id={grade.id} size={large ? 44 : 20} />{/if}{grade.name}</span>
