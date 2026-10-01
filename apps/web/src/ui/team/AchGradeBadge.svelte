<script lang="ts">
  // T-11-028 시즌 업적 등급 배지(내 팀 업적 요약 · 업적 랭킹 공용). 색은 style.css .ach-grade[data-grade].
  import type { AchGrade } from '@offside/contracts/owner-team';

  let { grade, large = false }: { grade: AchGrade; large?: boolean } = $props();
</script>

<span class="ach-grade" class:large data-grade={grade.id}>{grade.name}</span>
