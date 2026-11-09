<script lang="ts">
  // ui.ts renderRetired() 포트 (398~414줄). 리포트 본문은 LegendReport(T-10-005)로 옮겼다.
  import { onMount, tick, type Component } from 'svelte';
  import { appState } from './state.svelte.js';
  import { go, goHome, goNew } from './nav.js';
  import { loadHOF } from '@offside/game/hof-store';
  import { latestBalance } from '@offside/game/balance';
  import { viewFromGame } from './legend.js';
  import Topbar from './Topbar.svelte';
  import LegendReport from './LegendReport.svelte';
  import OwnHofCards from './OwnHofCards.svelte';
  import ShareBar from './ShareBar.svelte';
  import RetireCohort from './RetireCohort.svelte';
  import { retiredText as L } from '@offside/app-core/i18n/ko/retired';
  import { retirementUploadStatus } from '@offside/app-core/outboxStore';
  import {
    pickRetireScenes,
    profileKey,
    retireAccount,
    retireArm,
    retireExpShare,
    type RetireArm,
    type RetireCta,
    type RetireScene,
    type RetireSceneKind,
  } from '@offside/app-core/retireExperiment';
  import { accountCache, accountFresh, accountGeneration, freshAccount } from './account-state.svelte.js';
  import { retireExp } from '../analytics/index.js';

  const v = $derived(viewFromGame(appState.G!));
  // T-11-611 첫 커리어만 끝내고 떠나는 사람이 가장 많다. 첫 은퇴에만 내 구단으로 가는 길을 함께 보여 준다(서버 요청 없이 기기 기록으로 판단).
  const firstRetire = loadHOF().length <= 1;

  // ───────── T-11-669 은퇴 화면 실험(기본 꺼짐) ─────────
  // 서버 최신 밸런스의 retireExpShare가 0이면(기본 · 못 받음) 아무것도 하지 않는다(계정도 묻지 않는다).
  // 켜져 있으면 프로필 ID로 고정 배정하고, 실험군만 맨 위 대표 장면 · 다음 행동을 본다. 대조군은 지금 화면 그대로다.
  const t0 = performance.now();
  const share = retireExpShare(latestBalance());
  const cid = appState.G?.cid ?? '';
  let arm = $state<RetireArm | null>(null);
  let Exp = $state<Component<{
    cid: string;
    pos: string;
    scenes: RetireScene[];
    account: ReturnType<typeof retireAccount>;
    onscene: (kind: RetireSceneKind) => void;
    oncta: (cta: RetireCta) => void;
  }> | null>(null);
  let scenes = $state<RetireScene[]>([]);
  let alive = true;
  let left = false;
  let interacted = false;
  const account = $derived(retireAccount(accountCache.value));

  function pickScenes(a: RetireArm): RetireScene[] {
    try {
      return pickRetireScenes(appState.G?.career ?? []);
    } catch {
      retireExp.error(a, 'scenes');
      return [];
    }
  }

  async function decide() {
    if (share <= 0 || !cid) return;
    // 처음이거나 5분 지난 캐시면 다시 확인이 끝날 때까지(최대 3초) 기다린다. 못 받거나 ID가 없으면 실험 밖(지금 화면, 계측 없음).
    await Promise.race([freshAccount(), new Promise((r) => setTimeout(r, 3000))]);
    const gen = accountGeneration();
    // 3초 안에 다시 확인하지 못해 옛 캐시만 남았으면 그 ID로 배정하지 않는다.
    if (!alive || !accountFresh()) return;
    const p = accountCache.value;
    const id = p && p !== 'error' ? p.id : null;
    const a = retireArm(id, share);
    if (!a || !id) return;
    const picked = pickScenes(a);
    if (a === 'treatment') Exp = (await import('./RetireExp.svelte')).default;
    // 기다리는 사이 계정이 바뀌었으면 이 배정을 버린다.
    if (!alive || gen !== accountGeneration()) return;
    scenes = picked;
    arm = a;
    await tick();
    requestAnimationFrame(() => {
      if (!alive) return;
      // 이용 분석이 아직 준비되지 않았으면 준비될 때 노출을 보낸다(그 전 클릭은 보내지 않는다).
      retireExp.view({
        arm: a,
        cid,
        order: firstRetire ? 'first' : 'repeat',
        upload: retirementUploadStatus(cid).state,
        account: retireAccount(accountCache.value),
        scenes: picked.length,
        readyMs: performance.now() - t0,
        pk: profileKey(id)!,
      });
    });
  }

  function onHide() {
    if (document.visibilityState !== 'hidden' || !arm || left) return;
    left = true;
    retireExp.leave(arm, { dwellMs: performance.now() - t0, interacted, via: 'hide' });
  }
  onMount(() => {
    void decide();
    document.addEventListener('visibilitychange', onHide);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onHide);
      if (arm && !left) retireExp.leave(arm, { dwellMs: performance.now() - t0, interacted, via: 'nav' });
      else retireExp.end();
    };
  });
  // 버튼 · 링크를 하나라도 눌렀으면 즉시 이탈이 아니다.
  function noteClick(e: MouseEvent) {
    if ((e.target as Element | null)?.closest?.('button, a, summary')) interacted = true;
  }

  function onCta(cta: RetireCta) {
    if (arm) retireExp.cta(arm, cta);
    if (cta === 'team') {
      appState.teamView = 'team';
      go('team');
    } else go('owner');
  }
  function onMyClub() {
    if (arm === 'control') retireExp.cta('control', 'legacy_club');
    go('owner');
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="wrap" onclickcapture={noteClick}>
  <Topbar />
  {#if arm === 'treatment' && Exp}
    <Exp {cid} pos={appState.G?.pos ?? ''} {scenes} {account} onscene={(k) => retireExp.scene('treatment', k)} oncta={onCta} />
  {/if}
  <!-- T-11-675 같은 시즌 · 같은 포지션 은퇴 선수 중 내 기록의 자리(분포가 있을 때만). -->
  <RetireCohort {v} />
  <!-- T-10-029: 명예의 전당 공개·다음 버튼은 크레딧 맨 아래에, 공유 버튼은 화면 아래에 고정된다(T-10-067). -->
  <LegendReport {v} fresh={appState.G?.cid}>
    {#snippet end()}
      {#if v.own?.id}<OwnHofCards {v} />{/if}
      {#await import('./AppConversion.svelte') then { default: AppConversion }}<AppConversion context="retire" />{/await}
      <button class="btn btn-primary btn-block" data-act="new" onclick={goNew}>{L.newCareer}</button>
      <!-- T-11-669 실험군은 맨 위 다음 행동이 내 구단 길을 맡으므로 같은 버튼을 두 번 두지 않는다. -->
      {#if firstRetire && arm !== 'treatment'}<button class="btn btn-block" data-act="my-club" onclick={onMyClub}>{L.myClub}</button>{/if}
      <button class="btn btn-block" data-act="home" onclick={goHome}>{L.seeHof}</button>
    {/snippet}
  </LegendReport>
  {#if v.shareId}<ShareBar id={v.shareId} />{/if}
</div>
