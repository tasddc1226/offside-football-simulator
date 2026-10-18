<script lang="ts">
  // T-11-373 카드 강화 창(앱 screens/owner/EnhanceSheet.tsx). 열 때 상태를 한 번 받고, 시도는 서버가 판정한다. 결과는 1초쯤
  // 보여 주고 건너뛸 수 있다(움직임 줄이기면 바로). 실패 문구는 담담하게 쓴다.
  import type { TeamPlayer } from '@offside/app-core/api/team';
  import { enhanceCard, fetchEnhanceState, type EnhanceResponse, type EnhanceStateResponse } from '@offside/app-core/api/cardEnhance';
  import { enhanceErrorText, enhanceResultText, enhanceView } from '@offside/app-core/cardEnhance';
  import { fundsText } from '@offside/app-core/funds';
  import { cardEnhanceText as L } from '@offside/app-core/i18n/ko/cardEnhance';
  import { lockScroll } from '../scrollLock.js';
  import { untrack } from 'svelte';

  let { player, name, onclose, onresult }: {
    player: TeamPlayer;
    name: string;
    onclose: () => void;
    /** 성공 · 실패 모두 — 카드의 새 단계 · 연속 실패. */
    onresult: (r: EnhanceResponse) => void;
  } = $props();

  let dialog: HTMLDialogElement;
  let info = $state<EnhanceStateResponse | null>(null);
  let status = $state<'loading' | 'ready' | 'error'>('loading');
  let busy = $state(false);
  let rolling = $state(false);
  let result = $state<EnhanceResponse | null>(null);
  let error = $state<string | null>(null);
  // 창 안에서 바뀐 카드 단계(부모가 다시 그리기 전에도 다음 시도에 쓴다).
  let card = $state(untrack(() => ({ enhance: player.enhance ?? 0, enhanceFails: player.enhanceFails ?? 0 })));

  const view = $derived(info ? enhanceView(card, info.rules, info.balance, info.used, !!player.listing) : null);
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function load() {
    status = 'loading';
    const r = await fetchEnhanceState();
    if (!r.ok) return (status = 'error');
    info = r.data;
    status = 'ready';
  }

  $effect(() => {
    dialog.showModal();
    void load();
    const unlock = lockScroll();
    return () => {
      clearTimeout(timer);
      unlock();
    };
  });

  function settle() {
    clearTimeout(timer);
    rolling = false;
  }

  async function go() {
    if (!view || view.block || view.cost === null || busy) return;
    busy = true;
    error = null;
    result = null;
    const r = await enhanceCard(player.careerId, view.level, view.cost);
    busy = false;
    if (!r.ok) {
      error = enhanceErrorText(r.error);
      // 단계 · 비용이 어긋났으면 새 상태로 다시 그린다.
      if (r.error.reason === 'ENHANCE_STALE') void load();
      return;
    }
    card = { enhance: r.data.to, enhanceFails: r.data.fails };
    if (info) info = { ...info, balance: r.data.balance, used: r.data.used };
    result = r.data;
    onresult(r.data);
    if (!reduce) {
      rolling = true;
      timer = setTimeout(settle, 1000);
    }
  }
</script>

<dialog bind:this={dialog} aria-labelledby="enhance-title" onclose={onclose} data-enhance-sheet>
  <header><h2 id="enhance-title">{L.title}</h2><button class="close" aria-label={L.close} onclick={() => dialog.close()}>×</button></header>
  <p class="who"><strong>{name}</strong><span class="lv" data-enhance-level>{card.enhance ? `+${card.enhance}` : '+0'}</span></p>
  {#if status === 'loading'}
    <p class="muted fs-sm" aria-busy="true">…</p>
  {:else if status === 'error' || !view || !info}
    <p class="note" data-enhance-error>{L.loadFail}</p>
    <button class="btn btn-block" onclick={load}>{L.retry}</button>
  {:else}
    <dl class="grid">
      <div><dt>{L.now} → {L.next}</dt><dd data-enhance-step>{view.next === null ? `+${view.level}` : `+${view.level} → +${view.next}`}</dd></div>
      <div><dt>{L.rate}</dt><dd data-enhance-rate>{view.next === null ? '-' : view.ratePct}</dd></div>
      <div><dt>{L.cost}</dt><dd data-enhance-cost>{view.costText}</dd></div>
      <div><dt>{L.balance}</dt><dd data-enhance-balance>{fundsText(info.balance)}</dd></div>
    </dl>
    {#if view.next !== null}<p class="muted fs-sm" data-enhance-fail>{view.failText}</p>{/if}
    {#if view.pityText}<p class="muted fs-sm" data-enhance-pity>{view.pityText}</p>{/if}
    {#if view.effectText}<p class="muted fs-sm">{view.effectText}</p>{/if}
    {#if rolling}
      <div class="roll" role="status" data-enhance-rolling><span class="bar"></span><button class="text-button" onclick={settle}>{L.skip}</button></div>
    {:else if result}
      <p class="result" class:good={result.success} role="status" data-enhance-result={result.success ? 'success' : 'fail'}>{enhanceResultText(result)}</p>
    {/if}
    {#if error}<p class="note" role="alert" data-enhance-error>{error}</p>{/if}
    {#if view.block}<p class="note" data-enhance-block>{view.block}</p>{/if}
    <button class="btn btn-primary btn-block" disabled={busy || rolling || !!view.block} onclick={go} data-act="enhance-go">{busy ? L.going : L.go}</button>
    <p class="muted fs-xs foot">{view.leftText} · {L.effectNote}</p>
  {/if}
</dialog>

<style>
  dialog{box-sizing:border-box;width:min(400px,calc(100% - 24px));max-width:100%;max-height:85dvh;overflow:auto;overscroll-behavior:contain;border:1px solid var(--line);border-radius:18px;padding:20px;background:var(--surface);color:var(--ink);}
  dialog::backdrop{background:#0009;}
  header{display:flex;align-items:center;justify-content:space-between;gap:8px;}
  h2{font-size:18px;margin:0;}
  .close{flex:none;width:44px;height:44px;border:0;background:transparent;color:inherit;font-size:28px;cursor:pointer;}
  .who{display:flex;align-items:baseline;gap:8px;margin:4px 0 12px;overflow-wrap:anywhere;}
  .lv{font-family:var(--display);font-weight:700;font-size:1.4rem;color:var(--accent-text);}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 10px;}
  .grid div{border:1px solid var(--line);border-radius:10px;padding:8px 10px;}
  .grid dt{font-size:.72rem;color:var(--muted);}
  .grid dd{margin:2px 0 0;font-weight:700;font-variant-numeric:tabular-nums;}
  .note{padding:10px 12px;border-radius:10px;background:var(--surface-2);font-size:13px;line-height:1.6;}
  .roll{display:flex;align-items:center;gap:10px;margin:10px 0;}
  .bar{flex:1;height:6px;border-radius:999px;background:linear-gradient(90deg,var(--accent) 0 40%,var(--surface-2) 40%);background-size:200% 100%;animation:enh-roll 1s linear;}
  @keyframes enh-roll{from{background-position:100% 0;}to{background-position:0 0;}}
  .result{margin:10px 0;font-weight:600;}
  .result.good{color:var(--good);}
  .foot{margin-top:10px;line-height:1.6;}
</style>
