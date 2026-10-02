<script lang="ts">
  // 상대 고르기 — 내 팀 OVR과 비슷한 다른 구단주의 팀에 도전한다. 경기할 수 없으면(hint) 목록 대신 이유를 보여 준다.
  import { TEAM_REPEAT_WINDOW_DAYS } from '@offside/contracts/owner-team';
  import type { TeamOpponent } from '@offside/app-core/api/team';
  import { recordText } from '@offside/app-core/teamText';
  import LoadState, { type LoadStatus } from '../LoadState.svelte';

  let {
    ovr,
    matchesLeft,
    perDay,
    opponents,
    status,
    playing,
    hint,
    onreload,
    onchallenge,
    onmore,
    ontoTeam,
  }: {
    ovr: number;
    matchesLeft: number;
    perDay: number;
    opponents: TeamOpponent[];
    status: LoadStatus;
    playing: boolean;
    /** 지금은 경기할 수 없는 이유(경기할 수 있으면 비어 있다). */
    hint: string | null;
    onreload: () => void;
    onchallenge: (o: TeamOpponent) => void;
    /** '다른 상대 보기' — 목록을 다시 불러온다. */
    onmore: () => void;
    /** 편성 화면으로(편집할 수 있을 때만 넘긴다). */
    ontoTeam?: (() => void) | undefined;
  } = $props();
</script>

<section class="card stack" style="gap:12px">
  <div>
    <div class="eyebrow">Match</div>
    <h1>상대 고르기</h1>
    {#if !hint}<p class="muted fs-sm">내 팀 OVR {ovr}과 비슷한 팀이에요 · 오늘 남은 경기 {matchesLeft}/{perDay}</p>{/if}
    <p class="muted fs-xs">같은 팀에는 하루 한 번 도전할 수 있어요. 최근 {TEAM_REPEAT_WINDOW_DAYS}일 안에 다시 만난 팀이면 레이팅이 덜 움직여요.</p>
  </div>
  {#if hint}
    <p class="muted" data-match-hint>{hint}</p>
    {#if ontoTeam}<button class="btn self-start" onclick={ontoTeam}>편성으로</button>{/if}
  {:else}
  <LoadState {status} failText="상대를 불러오지 못했어요." retry={onreload}>
    {#each opponents as o (o.teamId)}
      <div class="tm-opp" data-opponent={o.teamId}>
        <div class="tm-opp-info">
          <b>{o.name}</b>
          <span class="muted fs-sm">{o.owner} · {o.formation} · {recordText(o.record)}</span>
        </div>
        <span class="tm-opp-ovr">{o.ovr}</span>
        <button class="btn btn-primary btn-sm" disabled={playing || matchesLeft === 0} onclick={() => onchallenge(o)} data-act="team-challenge">도전</button>
      </div>
    {:else}
      <p class="muted">아직 겨룰 팀이 없어요. 다른 구단주가 팀을 꾸리면 여기에 나와요.</p>
    {/each}
    <button class="icon-btn self-start" onclick={onmore} disabled={playing}>다른 상대 보기</button>
  </LoadState>
  {/if}
</section>

<style>
  .tm-opp {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 0;
    border-top: 1px solid var(--line);
  }
  .tm-opp-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .tm-opp-ovr {
    flex: none;
    min-width: 2.2em;
    font-family: var(--display);
    font-size: 1.375rem;
    font-weight: 700;
    text-align: center;
    color: var(--accent-text);
  }
</style>
