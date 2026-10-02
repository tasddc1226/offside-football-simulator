<script lang="ts">
  // 내 팀 편성 화면의 포메이션 · 필드 · 자동 배치/저장 카드.
  import { FORMATION_IDS, LINEUP_SIZE, type FormationId } from '@offside/contracts/owner-team';
  import type { OwnerTeam, TeamLines as Lines, TeamPlayer } from '@offside/app-core/api/team';
  import TeamLines from './TeamLines.svelte';
  import TeamPitch from './TeamPitch.svelte';

  let {
    team,
    editable,
    formation = $bindable(),
    lines,
    cells,
    players,
    seasonName,
    filled,
    saving,
    nameOk,
    dirty,
    onpick,
    onauto,
    onsave,
  }: {
    team: OwnerTeam | null;
    editable: boolean;
    formation: FormationId;
    lines: Lines;
    cells: { rating: number; name: string; youth: boolean }[];
    players: TeamPlayer[];
    seasonName: string;
    filled: number;
    saving: boolean;
    nameOk: boolean;
    dirty: boolean;
    /** 필드의 자리를 눌렀다(편집할 수 있을 때만 연결된다). */
    onpick: (i: number) => void;
    onauto: () => void;
    onsave: () => void;
  } = $props();
</script>

{#if editable || team}
  <section class="card stack" style="gap:10px" aria-label="포메이션">
    <div class="seg three" role="group" aria-label="포메이션">
      {#each FORMATION_IDS as f (f)}
        <button class="opt tm-form" aria-pressed={formation === f} data-formation={f} disabled={!editable} onclick={() => (formation = f)}>{f}</button>
      {/each}
    </div>
    <TeamLines {lines} />
    {#if editable}<p class="muted fs-sm">포메이션을 바꾸면 공격·중원·수비 무게가 옮겨 가요. 선수는 자리마다 그 자리 능력치로 뛰어요.</p>{/if}
  </section>
  <TeamPitch {formation} {cells} onpick={editable ? onpick : undefined} />
{/if}

{#if editable}
  <section class="card stack" style="gap:10px">
    {#if players.length === 0}
      <p class="muted">{seasonName}에 뛰고 은퇴한 선수가 아직 없어요. 이번 시즌에 커리어를 끝까지 뛰면 팀에 넣을 수 있어요.</p>
    {:else}
      <p class="muted fs-sm">선수 {filled}명 · 유스 {LINEUP_SIZE - filled}명. 자리를 누르면 선수를 바꿀 수 있어요.</p>
    {/if}
    <div class="tm-actions">
      <button class="btn" onclick={onauto} disabled={players.length === 0} data-act="team-auto">자동 배치</button>
      <button class="btn btn-primary" onclick={onsave} disabled={saving || !nameOk || !dirty} data-act="team-save">{team ? (dirty ? '편성 저장' : '저장됨') : '팀 만들기'}</button>
    </div>
  </section>
{/if}

<style>
  .tm-form {
    align-items: center;
    font-family: var(--display);
    font-weight: 700;
    font-size: 1.0625rem;
  }
  .tm-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
</style>
