<script lang="ts">
  import Skeleton from './Skeleton.svelte';
  // T-10-029 공유 링크(/career/<id>)로 들어온 보기 전용 은퇴 리포트. 크레딧 연출로 보여 주고, 끝나면
  // 내 커리어를 시작하도록 권한다. 이름 공개·공유 같은 선수 주인 기능은 없다.
  // T-11-439 시작 버튼을 맨 위에도 작게 두고(B8), 공개된 이름은 맨 아래에서 신고할 수 있다(스토어 UGC 정책). 신고는 누를 때만
  // 프로필을 만들어 보낸다 — 화면을 여는 것만으로는 세션·프로필을 조회하지 않는다.
  import { onMount } from 'svelte';
  import { appState, type LegendView } from './state.svelte.js';
  import { loadSharedLegend } from './legend.js';
  import { goHome, goNew } from './nav.js';
  import Topbar from './Topbar.svelte';
  import LegendReport from './LegendReport.svelte';
  import NameReport from './NameReport.svelte';
  import NameReports from './NameReports.svelte';
  import { shareText as L } from '@offside/app-core/i18n/ko/share';
  import { shellInstallText as A } from '@offside/app-core/i18n/ko/shellInstall';
  import { trackAppConversion, trackAppStoreClick } from '../analytics/index.js';
  import { osOf } from './inapp.js';

  let v = $state<LegendView | 'missing' | 'error' | null>(null);
  // T-11-779 휴대폰이면 끝 카드에 그 기기의 스토어로 가는 보조 버튼을 둔다. 스토어 주소(유입 캠페인 포함)는 지연 청크에서 채우고,
  // 주소가 준비돼야 버튼을 그린다. 공유 링크의 career_share 캠페인이 스토어 주소에 실려 공유로 생긴 설치를 구분한다.
  const os = osOf(navigator.userAgent);
  let storeHref = $state<string | undefined>();
  let inPlace = $state(false);
  let viewed = false;

  async function load() {
    v = null;
    v = await loadSharedLegend(appState.sharedCareer!);
    // 보임은 리포트가 열렸을 때 한 번만 센다(다시 시도해도 다시 세지 않는다).
    if (os !== 'other' && typeof v === 'object' && !viewed) {
      viewed = true;
      trackAppConversion('view', 'shared', os);
    }
  }
  onMount(() => {
    void load();
    if (os === 'other') return;
    void import('./appStore.js').then(({ storeUrl, opensInPlace }) => {
      storeHref = storeUrl(os);
      inPlace = opensInPlace(storeHref);
    });
  });
  function storeClick() {
    if (os === 'other') return;
    trackAppConversion('click', 'shared', os);
    trackAppStoreClick('shared', os);
  }

  // T-11-676 이 기기에 커리어가 없으면(처음 온 사람) 홈을 거치지 않고 바로 선수 만들기로 간다. 있으면 지금처럼 홈으로.
  function leave() {
    window.history.replaceState(window.history.state, '', '/'); // 방문 기록(T-10-114)은 그대로 둔다.
    appState.sharedCareer = null;
    if (appState.G) goHome();
    else goNew();
    window.scrollTo(0, 0);
  }
  const cta = $derived(appState.G ? L.ctaGame : L.ctaNew);
</script>

<div class="wrap">
  <Topbar />
  {#if v === null}
    <section class="card"><Skeleton rows={4} /></section>
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
    <div class="shared-top"><button class="btn btn-sm btn-primary" data-act="shared-start-top" onclick={leave}>{cta}</button></div>
    <LegendReport {v}>
      {#snippet end()}
        <section class="card stack">
          <div><div class="eyebrow">Your Turn</div><h2>{L.turnTitle}</h2></div>
          <p class="muted fs-sm">{L.turnBodyWeb}</p>
          <button class="btn btn-primary btn-block" data-act="shared-start" onclick={leave}>{cta}</button>
          {#if storeHref}
            <a class="btn btn-block" data-act="shared-app-store" data-store={os} href={storeHref} target={inPlace ? undefined : '_blank'} rel="noopener noreferrer" onclick={storeClick}>{A.stripGet}</a>
          {/if}
        </section>
      {/snippet}
    </LegendReport>
    {#if v.reportId}<NameReports><NameReport kind="career" id={v.reportId} name={v.name} /></NameReports>{/if}
  {/if}
</div>
