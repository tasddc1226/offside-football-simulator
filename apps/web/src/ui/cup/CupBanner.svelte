<script lang="ts">
  // T-11-145 구단주 화면의 오프사이드 컵 배너 — 단계별 한 줄 안내와 내 상태(신청·다음 경기·명단 마감·성적). 대회는 누구나
  // 보니 공개 응답(30초 메모)만으로 그리고, 로그인한 구단주일 때만 내 상태를 한 번 더 묻는다. 불러오지 못하면 배너를 숨긴다.
  import { fetchCup, fetchCupMe, type CupMeResponse, type CupResponse } from '@offside/app-core/api/cup';
  import { cupText as L } from '@offside/app-core/i18n/ko/cup';
  import CupEntry from './CupEntry.svelte';
  import { phaseLabel, phaseLine } from './cupView.js';

  let { linked, onopen }: { linked: boolean; onopen: () => void } = $props();

  let data = $state<CupResponse | null>(null);
  let me = $state<CupMeResponse | null>(null);

  async function loadCup() {
    const r = await fetchCup();
    if (r.ok) data = r.data;
  }
  async function loadMe() {
    const r = await fetchCupMe();
    me = r.ok ? r.data : null;
  }
  const reload = () => void Promise.all([loadCup(), linked ? loadMe() : undefined]);

  $effect(() => void loadCup());
  $effect(() => {
    if (linked) void loadMe();
    else me = null;
  });
</script>

{#if data}
  <section class="card cup-banner" aria-label={L.title} data-cup-banner data-cup-phase={data.phase}>
    <div class="cb-head">
      <div class="cb-who">
        <small class="eyebrow">Offside Cup · {L.edition({ n: data.cup.edition })}</small>
        <h2>{L.fullTitle({ n: data.cup.edition })}</h2>
        <span class="muted fs-sm" data-cup-line>{phaseLine(data)}</span>
      </div>
      <span class="pill" class:good={data.phase === 'open' || data.phase === 'group' || data.phase === 'knockout'}>{phaseLabel(data.phase)}</span>
    </div>
    <CupEntry {data} {me} {linked} onchanged={reload} />
    <button class="btn btn-block" data-act="cup-open" onclick={onopen}>{L.open}</button>
  </section>
{/if}

<style>
  .cup-banner {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .cup-banner h2 {
    margin: 0;
    overflow-wrap: anywhere;
  }
  .cb-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }
  .cb-who {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .cb-head .pill {
    flex: none;
  }
</style>
