<script lang="ts">
  // T-11-423 아마축구 상호 홈 팝업 — 웹을 열어 홈에 왔을 때 한 번 아래에서 올라오는 시트로 소재 한 장을 띄운다
  // (규칙은 app-core partnerPopup.ts). 출석 · 컵 우승 창 다음 차례로 띄우고(T-11-423c), 다른 창이 열려
  // 있거나 업무 모드면 띄우지 않는다. 그림을 누르면 기기에 맞는 아마축구 스토어(PC는 웹)를 새 탭으로 연다. 서버 요청은 없다(그림만 public에서).
  import { onMount } from 'svelte';
  import {
    PARTNER_POPUP,
    hidePartnerPopupToday,
    markPartnerPopupShown,
    partnerPopupToShow,
    type PartnerVariant,
  } from '@offside/app-core/partnerPopup';
  import { claimHomePopup, homePopupTurn } from '@offside/app-core/homePopup';
  import { partnerText as L } from '@offside/app-core/i18n/ko/partner';
  import { trackPartnerPopup } from '../analytics/index.js';
  import { motionOK } from './motion.js';
  import { lockScroll } from './scrollLock.js';
  import { osOf } from './inapp.js';
  import { sheetOn } from './skin.svelte.js';

  const WAIT_MS = 1200;
  const LEAVE_MS = 220;

  let variant = $state<PartnerVariant | null>(null);
  let leaving = $state(false);
  let dialog = $state<HTMLDivElement | null>(null);

  onMount(() => {
    if (!partnerPopupToShow()) return;
    let alive = true;
    const t = setTimeout(async () => {
      // T-11-423c 홈 팝업 순서의 마지막 — 출석 · 컵 우승 창이 띄울지 정할 때까지 기다린다.
      await homePopupTurn('partner');
      const v = partnerPopupToShow();
      if (!alive || !v || sheetOn() || document.querySelector('[aria-modal="true"]') || !claimHomePopup('partner')) return;
      markPartnerPopupShown();
      variant = v;
      trackPartnerPopup('view', v);
    }, WAIT_MS);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  });

  $effect(() => {
    if (!variant) return;
    dialog?.focus();
    return lockScroll();
  });

  function close(action: 'close' | 'hide_today' | 'click' = 'close') {
    if (!variant || leaving) return;
    if (action === 'hide_today') hidePartnerPopupToday();
    if (action !== 'click') trackPartnerPopup(action, variant);
    leaving = true;
    setTimeout(
      () => {
        variant = null;
        leaving = false;
      },
      motionOK ? LEAVE_MS : 0,
    );
  }
  function open() {
    if (!variant) return;
    trackPartnerPopup('click', variant);
    window.open(PARTNER_POPUP.link(variant, osOf(navigator.userAgent)), '_blank', 'noopener');
    close('click');
  }
  const onkeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
</script>

{#if variant}
  <div
    class="pp-backdrop"
    class:leaving
    class:still={!motionOK}
    role="presentation"
    data-partner-popup={variant}
    onclick={(e) => e.target === e.currentTarget && close()}
  >
    <div class="pp" role="dialog" aria-modal="true" aria-label={L.aria} tabindex="-1" bind:this={dialog} {onkeydown}>
      <button class="pp-art" data-act="partner-open" aria-label={L.open} onclick={open}>
        <img src={PARTNER_POPUP.image(variant)} alt={variant === 'a' ? L.altA : L.altB} width="720" height="900" />
        <span class="pp-badge">{L.badge}</span>
      </button>
      <div class="pp-actions">
        <button class="pp-link" data-act="partner-hide-today" onclick={() => close('hide_today')}>{L.hideToday}</button>
        <button class="pp-link pp-close" data-act="partner-close" onclick={() => close()}>{L.close}</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .pp-backdrop {
    position: fixed;
    inset: 0;
    z-index: 11;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    background: rgba(8, 14, 11, 0.62);
    animation: pp-fade 0.25s ease both;
    transition: opacity 0.2s ease;
  }
  .pp-backdrop.leaving {
    opacity: 0;
    pointer-events: none;
  }
  .pp {
    width: min(440px, 100%);
    max-height: calc(100svh - 24px);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    border-radius: 20px 20px 0 0;
    background: var(--surface);
    outline: none;
    animation: pp-up 0.32s cubic-bezier(0.2, 0.9, 0.3, 1) both;
  }
  .pp-backdrop.leaving .pp {
    transform: translateY(24px);
    transition: transform 0.2s ease;
  }
  .pp-art {
    position: relative;
    display: block;
    min-height: 0;
    padding: 0;
    border: 0;
    background: #f3f4f8;
    cursor: pointer;
  }
  .pp-art img {
    display: block;
    width: 100%;
    height: auto;
    max-height: calc(100svh - 84px);
    object-fit: contain;
  }
  .pp-badge {
    position: absolute;
    bottom: 10px;
    left: 10px;
    padding: 2px 8px;
    border-radius: 999px;
    background: rgba(8, 14, 11, 0.55);
    color: #fff;
    font-size: var(--fs-caption2);
  }
  .pp-actions {
    display: flex;
    justify-content: space-between;
    padding: 4px 8px calc(4px + env(safe-area-inset-bottom));
  }
  .pp-link {
    min-height: 44px;
    padding: 0 12px;
    border: 0;
    background: none;
    color: var(--muted);
    font: inherit;
    font-size: var(--fs-body2);
    cursor: pointer;
  }
  .pp-close {
    color: var(--ink);
    font-weight: 700;
  }
  .still,
  .still .pp {
    animation: none;
  }
  @keyframes pp-fade {
    from {
      opacity: 0;
    }
  }
  @keyframes pp-up {
    from {
      transform: translateY(100%);
    }
  }
</style>
