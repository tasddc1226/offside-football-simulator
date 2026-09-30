<script lang="ts">
  // T-10-092 팀의 공격·중원·수비·골문 힘(내 팀 편성 · 팀 프로필).
  import type { TeamLines } from '@offside/app-core/api/team';

  let { lines }: { lines: TeamLines } = $props();

  const CELLS = [
    ['atk', '공격'],
    ['mid', '중원'],
    ['def', '수비'],
    ['gk', '골문'],
  ] as const;
</script>

<dl class="team-lines" data-team-lines>
  {#each CELLS as [k, label] (k)}
    <div><dt>{label}</dt><dd>{Math.round(lines[k])}</dd></div>
  {/each}
</dl>

<style>
  .team-lines {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
    margin: 0;
  }
  .team-lines div {
    display: grid;
    place-items: center;
    padding: 6px 0;
    border-radius: 10px;
    background: var(--surface-2);
  }
  .team-lines dt {
    font-size: 0.75rem;
    color: var(--muted);
  }
  .team-lines dd {
    margin: 0;
    font-family: var(--display);
    font-size: 1.25rem;
    font-weight: 700;
  }
</style>
