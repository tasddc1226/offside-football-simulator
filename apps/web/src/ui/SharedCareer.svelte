<script lang="ts">
  // T-10-029 공유 링크(/career/<id>)로 들어온 보기 전용 은퇴 리포트. 크레딧 연출로 보여 주고, 끝나면
  // 내 커리어를 시작하도록 권한다. 이름 공개·공유 같은 선수 주인 기능은 없다.
  import { onMount } from 'svelte';
  import { appState, type LegendView } from './state.svelte.js';
  import { loadSharedLegend } from './legend.js';
  import { goHome } from './nav.js';
  import Topbar from './Topbar.svelte';
  import LegendReport from './LegendReport.svelte';

  let v = $state<LegendView | 'missing' | 'error' | null>(null);

  async function load() {
    v = null;
    v = await loadSharedLegend(appState.sharedCareer!);
  }
  onMount(load);

  function leave() {
    window.history.replaceState({}, '', '/');
    appState.sharedCareer = null;
    goHome();
    window.scrollTo(0, 0);
  }
  const cta = $derived(appState.G ? '내 커리어로 가기 →' : '나도 커리어 시작하기 →');
</script>

<div class="wrap">
  <Topbar />
  {#if v === null}
    <section class="card"><p class="muted">기록을 불러오는 중…</p></section>
  {:else if typeof v === 'string'}
    <section class="card stack" data-shared="unavailable">
      <div><div class="eyebrow">Shared Career</div><h2>{v === 'missing' ? '기록을 찾을 수 없어요' : '기록을 불러오지 못했어요'}</h2></div>
      <p class="muted" style="font-size:13px">
        {v === 'missing' ? '링크가 잘못되었거나 더 이상 공개되지 않는 기록이에요.' : '서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.'}
      </p>
      {#if v === 'error'}<button class="btn btn-block" onclick={load}>다시 시도</button>{/if}
      <button class="btn btn-primary btn-block" data-act="shared-start" onclick={leave}>{cta}</button>
    </section>
  {:else}
    <p class="shared-note" data-shared="view">공유받은 은퇴 커리어 · 보기 전용</p>
    <LegendReport {v} credits>
      {#snippet end()}
        <section class="card stack">
          <div><div class="eyebrow">Your Turn</div><h2>이제 당신의 차례예요</h2></div>
          <p class="muted" style="font-size:13px">유스에서 시작해 은퇴할 때까지, 나만의 축구 커리어를 만들어 보세요.</p>
          <button class="btn btn-primary btn-block" data-act="shared-start" onclick={leave}>{cta}</button>
        </section>
      {/snippet}
    </LegendReport>
  {/if}
</div>
