<script lang="ts">
  // T-11-373 카드 강화 창(앱 screens/owner/EnhanceSheet.tsx). 열 때 그 카드 상태를 한 번 받고, 시도는 서버가 판정한다. 응답을 받지
  // 못한 시도는 같은 멱등 키로 다시 보내 두 번 판정되지 않는다. 결과는 열린 카드(careerId)에만 돌려준다.
  import type { TeamPlayer } from '@offside/app-core/api/team';
  import { enhanceCard, fetchEnhanceState, type EnhanceResponse, type EnhanceStateResponse } from '@offside/app-core/api/cardEnhance';
  import { enhanceErrorText, enhanceKeepKey, enhanceResultText, enhanceView } from '@offside/app-core/cardEnhance';
  import { fundsText } from '@offside/app-core/funds';
  import { cardEnhanceText as L } from '@offside/app-core/i18n/ko/cardEnhance';
  import { lockScroll } from '../scrollLock.js';
  import Skeleton from '../Skeleton.svelte';
  import { untrack } from 'svelte';

  let { player, name, onclose, onresult }: {
    player: TeamPlayer;
    name: string;
    onclose: () => void;
    /** 성공 · 실패 모두 — 그 카드의 새 단계. */
    onresult: (careerId: string, r: EnhanceResponse) => void;
  } = $props();

  // 열 때의 카드로 고정한다(창이 열린 동안 부모가 다른 카드를 골라도 이 창은 이 카드만 다룬다).
  const careerId = untrack(() => player.careerId);
  const listed = untrack(() => !!player.listing);
  let dialog: HTMLDialogElement;
  let info = $state<EnhanceStateResponse | null>(null);
  let status = $state<'loading' | 'ready' | 'error'>('loading');
  let busy = $state(false);
  let result = $state<EnhanceResponse | null>(null);
  let error = $state<string | null>(null);
  let requestKey = crypto.randomUUID();

  const view = $derived(info ? enhanceView(info.card, info.rules, info.balance, listed) : null);

  async function load() {
    status = info ? 'ready' : 'loading';
    const r = await fetchEnhanceState(careerId);
    if (!r.ok) {
      if (!info) status = 'error';
      return;
    }
    info = r.data;
    status = 'ready';
  }

  $effect(() => {
    dialog.showModal();
    void load();
    return lockScroll();
  });

  async function go() {
    if (!view?.body || busy) return;
    busy = true;
    error = null;
    result = null;
    const r = await enhanceCard(careerId, view.body, requestKey);
    busy = false;
    if (!r.ok) {
      error = enhanceErrorText(r.error);
      // 응답을 받지 못했으면 같은 키로 다시 보낸다(서버가 이미 판정했으면 그 결과가 온다). 거절이면 새 키로.
      if (!enhanceKeepKey(r.error)) requestKey = crypto.randomUUID();
      // 상태가 어긋났으면 새 상태로 다시 그린다.
      if (r.error.reason === 'ENHANCE_STALE') void load();
      return;
    }
    requestKey = crypto.randomUUID();
    if (info) info = { ...info, balance: r.data.balance, card: r.data.card };
    result = r.data;
    onresult(careerId, r.data);
  }
</script>

<dialog bind:this={dialog} aria-labelledby="enhance-title" onclose={onclose} data-enhance-sheet>
  <header><h2 id="enhance-title">{L.title}</h2><button class="close" aria-label={L.close} onclick={() => dialog.close()}>×</button></header>
  <p class="who"><strong>{name}</strong><span class="lv" data-enhance-level>+{info?.card.level ?? player.enhance ?? 0}</span></p>
  {#if status === 'loading'}
    <Skeleton height={180} />
  {:else if status === 'error' || !view || !info}
    <p class="note" data-enhance-error>{L.loadFail}</p>
    <button class="btn btn-block" onclick={load}>{L.retry}</button>
  {:else}
    <dl class="grid">
      <div><dt>{L.now} → {L.next}</dt><dd data-enhance-step>{view.next === null ? `+${view.level}` : `+${view.level} → +${view.next}`}</dd></div>
      <div><dt>{L.rate}</dt><dd data-enhance-rate>{view.next === null ? '-' : view.ratePct}</dd></div>
      <div><dt>{L.cost}</dt><dd data-enhance-cost>{view.costText}</dd></div>
      <div><dt>{L.tries}</dt><dd data-enhance-tries>{view.triesText}</dd></div>
    </dl>
    {#if view.ovrText}<p class="ovr" data-enhance-ovr>{view.ovrText}</p>{/if}
    {#if view.next !== null}
      <p class="muted fs-sm">{L.failStay}{#if view.ceilingText} <span data-enhance-ceiling>{view.ceilingText}</span>{/if}</p>
    {/if}
    {#if result}
      <p class="result" class:good={result.success} role="status" data-enhance-result={result.success ? 'success' : 'fail'}>{enhanceResultText(result)}</p>
    {/if}
    {#if error}<p class="note" role="alert" data-enhance-error>{error}</p>{/if}
    {#if view.block}<p class="note" data-enhance-block>{view.block}</p>{/if}
    <button class="btn btn-primary btn-block" disabled={busy || !view.body} onclick={go} data-act="enhance-go">{busy ? L.going : L.go}</button>
    <p class="muted fs-xs foot">
      {L.balance} {fundsText(info.balance)}<br />
      {#if view.next !== null}{view.nextTryText} {/if}{L.triesHow({ n: info.rules.startsPerTry })}<br />
      {L.effectNote}
    </p>
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
  .ovr{margin:0 0 6px;font-weight:600;}
  .note{padding:10px 12px;border-radius:10px;background:var(--surface-2);font-size:13px;line-height:1.6;}
  .result{margin:10px 0;font-weight:600;}
  .result.good{color:var(--good);}
  .foot{margin-top:10px;line-height:1.6;}
</style>
