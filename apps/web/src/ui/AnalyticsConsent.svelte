<script lang="ts" module>
  // 팝업에서 한 번 고르면 서버 반영에 실패해도 이 페이지 방문 동안은 다시 띄우지 않는다(실패는 환경설정 카드에 남는다).
  let answered = false;
</script>

<script lang="ts">
  // T-11-417 이용 분석(GA4 · 메타 픽셀)과 유입 · 결제 연결을 카드 하나에서 항목별로 묻는다. 고르기 전이면 아래에서
  // 올라오는 창으로 띄우고(고를 때까지 닫히지 않는다), 환경설정에서는 같은 카드를 그 자리에 그린다. 항목은 따로
  // 동의받고(체크는 비워 둔 채 시작), 유입 · 결제 연결은 이용 분석에 동의해야 쓸 수 있어서 둘을 함께 켜고 끈다.
  import { onMount } from 'svelte';
  import { acquisitionEnabled, acquisitionStatus, acquisitionWithdrawalPending, setAcquisitionConsent } from '../analytics/acquisition.js';
  import { enabled, getConsent, onConsent, setConsent } from '../analytics/browser.js';
  import { getAdConsent, metaEnabled } from '../analytics/meta.js';
  import type { Consent } from '@offside/app-core/analytics-model';
  import { settingsText as L } from '@offside/app-core/i18n/ko/settings';
  import PopSheet from './PopSheet.svelte';
  import { consentByDefault } from '../consent-region.js';
  import { toast } from './helpers.js';
  const { settings = false }: { settings?: boolean } = $props();
  const acqOn = acquisitionEnabled();
  // T-11-597 유럽 · 영국 · 스위스 밖은 묻지 않고 켠 채로 시작한다(환경설정 카드에서 끌 수 있다).
  const byDefault = consentByDefault();
  let available = $state(false);
  let choice = $state<Consent>('unknown');
  // T-11-195 메타 픽셀이 켜진 빌드면 광고 측정도 같은 항목에서 묻는다. GA4만 골랐던 이용자에게는 한 번 더 묻는다.
  let meta = $state(false);
  let adChoice = $state<Consent>('unknown');
  // null: 서버에 묻는 중.
  let acq = $state<Consent | null>(null);
  let pending = $state(false);
  let failed = $state(false);
  let busy = $state(false);
  let done = $state(answered);
  let pickA = $state(false);
  let pickQ = $state(false);
  let touched = false;
  const granted = () => choice === 'granted' && (!meta || adChoice === 'granted');
  const read = () => {
    choice = getConsent();
    adChoice = getAdConsent();
    if (!touched) pickA = granted();
    // 고르는 중에는 서버에 다시 묻지 않는다(동의 직후 유입 세션이 두 번 기록된다). 고른 결과는 apply가 직접 반영한다.
    if (acqOn && !busy)
      void acquisitionStatus().then((v) => {
        acq = v;
        pending = acquisitionWithdrawalPending();
        if (!touched) pickQ = v === 'granted';
      });
  };
  onMount(() => {
    available = enabled();
    meta = metaEnabled();
    read();
    return onConsent(read);
  });
  const needA = $derived(choice === 'unknown' || (meta && adChoice === 'unknown'));
  const needQ = $derived(!byDefault && acqOn && choice === 'granted' && acq !== null && (acq === 'unknown' || failed));
  const ask = $derived(available && !settings && !done && (needA || needQ));
  const card = $derived(settings && (available || (acqOn && pending)));

  function toggleA(on: boolean) {
    touched = true;
    pickA = on;
    if (!on) pickQ = false;
  }
  function toggleQ(on: boolean) {
    touched = true;
    pickQ = on;
    if (on) pickA = true;
  }
  async function apply(a: boolean, q: boolean) {
    if (busy) return;
    busy = true;
    failed = false;
    let acqDone = false;
    // 이용 분석에 동의하기 전의 유입 상태('denied')는 고른 값이 아니라서, 이번에 처음 동의하면 고른 값을 꼭 저장한다.
    const fresh = choice !== 'granted';
    if (available) {
      if (a) setConsent('granted');
      else if (choice !== 'denied' || (meta && adChoice !== 'denied')) {
        // 이용 분석을 거두면 browser.ts가 유입 · 결제 연결도 함께 철회한다.
        setConsent('denied');
        acqDone = true;
        if (acqOn) {
          acq = 'denied';
          pending = acquisitionWithdrawalPending();
        }
      }
    }
    const want = a && q ? 'granted' : 'denied';
    if (acqOn && !acqDone && (fresh || acq !== want || pending)) {
      failed = !(await setAcquisitionConsent(want));
      pending = acquisitionWithdrawalPending();
      if (!failed) acq = want;
    }
    if (!settings) {
      answered = done = true;
      if (failed) toast(L.consentFailToast);
    }
    touched = false;
    busy = false;
    pickA = granted();
    pickQ = acq === 'granted';
  }
</script>

{#snippet body()}
  <strong>{L.consentCardTitle} <span class="muted">{L.consentOptional}</span></strong>
  {#if available}
    <label class="consent-item">
      <input type="checkbox" data-analytics="pick-analytics" checked={pickA} disabled={busy} onchange={(e) => toggleA(e.currentTarget.checked)} />
      <span>
        <b>{L.consentTitle}</b>
        <span class="muted">{L.consentBody1}</span>
        {#if meta}<span class="muted">{L.consentMeta}</span>{/if}
        <span class="muted">{L.consentBody2} <a href="/legal/privacy/#analytics">{L.consentMore}</a></span>
        {#if settings}<span>{L.consentNow} {granted() ? L.consentGranted : choice === 'unknown' ? L.consentUnset : L.consentDenied}</span>{/if}
      </span>
    </label>
  {/if}
  {#if acqOn}
    <label class="consent-item">
      <input type="checkbox" data-analytics="pick-acquisition" checked={pickQ} disabled={busy || pending} onchange={(e) => toggleQ(e.currentTarget.checked)} />
      <span>
        <b>{L.acquisitionTitle}</b>
        <span class="muted">{L.acquisitionBody} <a href="/legal/privacy/#acquisition">{L.consentMore}</a></span>
        {#if settings}<span>{L.consentNow} {acq === 'granted' ? L.consentGranted : acq === 'denied' ? L.consentDenied : L.consentUnset}</span>{/if}
        {#if failed || pending}<span role="alert">{L.acquisitionRetry}</span>{/if}
      </span>
    </label>
  {/if}
  <div class="analytics-choices">
    <button class="btn" data-analytics="deny" disabled={busy} onclick={() => apply(pickA, pickQ)}>
      {pickA || pickQ ? (settings ? L.consentSave : L.consentPick) : L.consentDenied}
    </button>
    <button class="btn btn-accent" data-analytics="accept" disabled={busy || pending} onclick={() => apply(true, true)}>{L.consentAll}</button>
  </div>
  {#if settings && byDefault}<p class="muted" data-analytics="default-note">{L.consentDefaultNote}</p>{/if}
  {#if settings}<p class="muted">{L.consentRevokeNote}</p>{/if}
{/snippet}

{#if card}
  <section class="card analytics-consent" aria-label={L.consentAria} data-analytics="consent">{@render body()}</section>
{:else if ask}
  <!-- 컵 우승 창(z-index 11) · 출석 창보다 위에 둬서 동의부터 고르게 한다. -->
  <div class="consent-layer">
    <PopSheet label={L.consentAria}>
      <div class="analytics-consent" data-analytics="consent">{@render body()}</div>
    </PopSheet>
  </div>
{/if}

<style>
  .consent-layer { position: relative; z-index: 12; }
  section.analytics-consent { padding: 16px; margin: 12px auto; max-width: 640px; }
  .analytics-consent { display: flex; flex-direction: column; gap: 12px; }
  .consent-item { display: flex; gap: 10px; align-items: flex-start; cursor: pointer; }
  .consent-item input { flex: none; width: 20px; height: 20px; margin: 2px 0 0; accent-color: var(--pitch); }
  .consent-item > span { display: flex; flex-direction: column; gap: 4px; font-size: 12px; line-height: 1.6; }
  .consent-item b { font-size: 14px; }
  p { font-size: 12px; line-height: 1.6; margin: 0; }
  .analytics-choices { display: flex; flex-wrap: wrap; gap: 8px; }
  .analytics-choices .btn { flex: 1; min-height: 44px; }
</style>
