<script lang="ts">
  // T-10-029 공유 링크(/career/<id>)로 들어온 보기 전용 은퇴 리포트. 크레딧 연출로 보여 주고, 끝나면
  // 내 커리어를 시작하도록 권한다. 이름 공개·공유 같은 선수 주인 기능은 없다.
  import { onMount } from 'svelte';
  import { appState, type LegendView } from './state.svelte.js';
  import { loadSharedLegend } from './legend.js';
  import { goHome } from './nav.js';
  import Topbar from './Topbar.svelte';
  import LegendReport from './LegendReport.svelte';
  import { shareText as L } from '@offside/app-core/i18n/ko/share';

  let v = $state<LegendView | 'missing' | 'error' | null>(null);

  async function load() {
    v = null;
    v = await loadSharedLegend(appState.sharedCareer!);
  }
  onMount(load);

  function leave() {
    window.history.replaceState(window.history.state, '', '/'); // 방문 기록(T-10-114)은 그대로 둔다.
    appState.sharedCareer = null;
    goHome();
    window.scrollTo(0, 0);
  }
  const cta = $derived(appState.G ? L.ctaGame : L.ctaNew);
</script>

<div class="wrap">
  <Topbar />
  {#if v === null}
    <section class="card"><p class="muted">{L.loading}</p></section>
  {:else if typeof v === 'string'}
    <section class="card stack" data-shared="unavailable">
      <div><div class="eyebrow">Shared Career</div><h2>{v === 'missing' ? L.missingTitle : L.errorTitle}</h2></div>
      <p class="muted fs-sm">
        {v === 'missing' ? L.missingBody : L.errorBody}
      </p>
      {#if v === 'error'}<button class="btn btn-block" onclick={load}>{L.retry}</button>{/if}
      <button class="btn btn-primary btn-block" data-act="shared-start" onclick={leave}>{cta}</button>
    </section>
  {:else}
    <p class="shared-note" data-shared="view">{L.viewNote}</p>
    <LegendReport {v}>
      {#snippet end()}
        <section class="card stack">
          <div><div class="eyebrow">Your Turn</div><h2>{L.turnTitle}</h2></div>
          <p class="muted fs-sm">{L.turnBodyWeb}</p>
          <button class="btn btn-primary btn-block" data-act="shared-start" onclick={leave}>{cta}</button>
        </section>
      {/snippet}
    </LegendReport>
  {/if}
</div>
