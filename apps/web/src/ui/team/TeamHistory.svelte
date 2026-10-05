<script lang="ts">
  // 최근 경기 — 이 시즌에 치른 경기 목록. 누르면 그 경기의 결과를 연다.
  import type { TeamMatch } from '@offside/app-core/api/team';
  import LoadState, { type LoadStatus } from '../LoadState.svelte';
  import TeamMatchRow from './TeamMatchRow.svelte';

  let {
    history,
    status,
    onreload,
    onopen,
  }: {
    history: TeamMatch[];
    status: LoadStatus;
    onreload: () => void;
    onopen: (m: TeamMatch) => void;
  } = $props();
</script>

<section class="card stack" style="gap:12px">
  <div>
    <div class="eyebrow">Matches</div>
    <h1>최근 경기</h1>
  </div>
  <LoadState {status} failText="경기 기록을 불러오지 못했어요." retry={onreload}>
    {#each history as m (m.id)}
      <TeamMatchRow {m} {onopen} />
    {:else}
      <p class="muted">아직 치른 경기가 없어요.</p>
    {/each}
  </LoadState>
</section>
