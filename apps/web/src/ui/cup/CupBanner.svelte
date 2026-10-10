<script lang="ts">
  // T-11-145 홈 화면의 오프사이드 컵 배너 — 단계별 한 줄 안내와 '대회 보기'. 대회는 누구나 보니 공개 응답(30초 메모)만으로
  // 그린다. 신청 · 내 상태는 대회 화면에서 한다. 취소됐거나 끝난 지 일주일이 지났거나 불러오지 못하면 배너를 숨긴다.
  import { fetchCup, type CupResponse } from '@offside/app-core/api/cup';
  import { cupText as L } from '@offside/app-core/i18n/ko/cup';
  import { cupOnHome } from '@offside/app-core/cupHome';
  import CupTrophy from './CupTrophy.svelte';
  import { phaseLabel, phaseLine } from './cupView.js';

  let { onopen }: { onopen: () => void } = $props();

  let data = $state<CupResponse | null>(null);

  $effect(() => {
    void fetchCup().then((r) => {
      if (r.ok) data = r.data;
    });
  });
</script>

{#if data && cupOnHome(data)}
  <button type="button" class="card cup-banner" aria-label={`${L.fullTitle({ n: data.cup.edition })} · ${L.open}`} data-cup-banner data-cup-phase={data.phase} data-act="cup-open" onclick={onopen}>
    <div class="cb-head">
      <CupTrophy stage="champion" size={44} bare />
      <div class="cb-who">
        <small class="eyebrow">Offside Cup · {L.edition({ n: data.cup.edition })}</small>
        <strong class="cb-title">{L.fullTitle({ n: data.cup.edition })}</strong>
        <span class="muted fs-sm" data-cup-line>{phaseLine(data)}</span>
      </div>
      <span class="pill" class:good={data.phase === 'open' || data.phase === 'group' || data.phase === 'knockout'}>{phaseLabel(data.phase)}</span>
    </div>
  </button>
{/if}

<style>
  .cup-banner {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    border: 0;
    text-align: left;
    color: var(--ink);
    cursor: pointer;
  }
  .cup-banner:hover {
    background: color-mix(in srgb, var(--accent) 6%, var(--surface));
  }
  .cb-title {
    font-size: 1.25rem;
    line-height: 1.3;
    margin: 0;
    overflow-wrap: anywhere;
  }
  .cb-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .cb-who {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .cb-head .pill {
    flex: none;
  }
</style>
