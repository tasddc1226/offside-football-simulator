<script lang="ts">
  // T-11-373 카드 강화 창(앱 screens/owner/EnhanceSheet.tsx). 열 때 그 카드 상태를 한 번 받고, 시도는 서버가 판정한다. 응답을 받지
  // 못한 시도는 같은 멱등 키로 다시 보내 두 번 판정되지 않는다. 결과는 열린 카드(careerId)에만 돌려준다.
  import type { TeamPlayer } from '@offside/app-core/api/team';
  import { holdAchCheck } from '@offside/app-core/achDirty';
  import { enhanceCard, fetchEnhanceState, type EnhanceResponse, type EnhanceStateResponse } from '@offside/app-core/api/cardEnhance';
  import { ENHANCE_CHARGE_MS, enhanceErrorText, enhanceKeepKey, enhanceResultKind, enhanceResultText, enhanceTitleText, enhanceView } from '@offside/app-core/cardEnhance';
  import { fundsText } from '@offside/app-core/funds';
  import { cardEnhanceText as L } from '@offside/app-core/i18n/ko/cardEnhance';
  import { buzz, dur } from '../motion.js';
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
  // 창이 열린 동안 시도마다 업적을 받지 않고, 닫을 때 한 번 확인한다.
  $effect(() => holdAchCheck());
  const careerId = untrack(() => player.careerId);
  const listed = untrack(() => !!player.listing);
  let dialog: HTMLDialogElement;
  let info = $state<EnhanceStateResponse | null>(null);
  let status = $state<'loading' | 'ready' | 'error'>('loading');
  let busy = $state(false);
  let result = $state<EnhanceResponse | null>(null);
  let error = $state<string | null>(null);
  let requestKey = crypto.randomUUID();

  const animate = dur(1) > 0;
  // 결과 연출. 다음 시도를 누르면 result가 비워져 같은 결과가 이어져도 다시 움직인다.
  const fx = $derived(result && animate ? enhanceResultKind(result) : null);
  const SPARKS = [0, 45, 90, 135, 180, 225, 270, 315];

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
    // load가 읽는 info를 이 effect의 의존성으로 삼으면 응답마다 다시 불러 요청이 끝없이 이어진다. 창을 열 때 한 번만 부른다.
    untrack(() => void load());
    return lockScroll();
  });

  async function go() {
    if (!view?.body || busy) return;
    busy = true;
    error = null;
    result = null;
    const started = Date.now();
    const r = await enhanceCard(careerId, view.body, requestKey);
    if (!r.ok) {
      busy = false;
      error = enhanceErrorText(r.error);
      // 응답을 받지 못했으면 같은 키로 다시 보낸다(서버가 이미 판정했으면 그 결과가 온다). 거절이면 새 키로.
      if (!enhanceKeepKey(r.error)) requestKey = crypto.randomUUID();
      // 상태가 어긋났으면 새 상태로 다시 그린다.
      if (r.error.reason === 'ENHANCE_STALE') void load();
      return;
    }
    requestKey = crypto.randomUUID();
    // 게이지가 다 찬 뒤 결과를 연다. 판정은 이미 끝났고 연출만 기다린다.
    const wait = dur(ENHANCE_CHARGE_MS) - (Date.now() - started);
    if (wait > 0) await new Promise((done) => setTimeout(done, wait));
    busy = false;
    if (enhanceResultKind(r.data) !== 'keep') buzz();
    if (info) info = { ...info, balance: r.data.balance, card: r.data.card };
    result = r.data;
    onresult(careerId, r.data);
  }
</script>

<dialog bind:this={dialog} aria-labelledby="enhance-title" onclose={onclose} data-enhance-sheet>
  <header><h2 id="enhance-title">{L.title}</h2><button class="close" aria-label={L.close} onclick={() => dialog.close()}>×</button></header>
  <div class="stage" class:charging={busy && animate} data-fx={fx} data-enhance-stage>
    {#if fx}<span class="flash" aria-hidden="true"></span>{/if}
    {#if fx === 'success'}
      <span class="burst" aria-hidden="true"><span class="ring"></span>{#each SPARKS as a (a)}<i style:--a="{a}deg"></i>{/each}</span>
    {/if}
    <strong class="who">{name}</strong>
    <span class="lv" data-enhance-level>+{info?.card.level ?? player.enhance ?? 0}</span>
    <span class="gauge" aria-hidden="true">{#if busy && animate}<i style:animation-duration="{ENHANCE_CHARGE_MS}ms"></i>{/if}</span>
    <p class="result" class:good={result?.success} class:bad={result && enhanceResultKind(result) === 'down'} role="status" data-enhance-result={result ? enhanceResultKind(result) : undefined}>{result ? enhanceResultText(result) : ''}</p>
  </div>
  {#if status === 'loading'}
    <Skeleton height={180} />
  {:else if status === 'error' || !view || !info}
    <p class="note" data-enhance-error>{L.loadFail}</p>
    <button class="btn btn-block" onclick={load}>{L.retry}</button>
  {:else}
    <dl class="grid">
      <div><dt>{L.now} → {L.next}</dt><dd data-enhance-step>{view.next === null ? `+${view.level}` : `+${view.level} → +${view.next}`}</dd></div>
      <div><dt>{L.rate}</dt><dd data-enhance-rate>{view.next === null ? '-' : view.ratePct}</dd></div>
      <div><dt>{L.keep}</dt><dd data-enhance-keep>{view.next === null ? '-' : view.keepPct}</dd></div>
      <div><dt>{L.fail}</dt><dd data-enhance-down>{view.next === null ? '-' : view.downPct}</dd></div>
      <div><dt>{L.cost}</dt><dd data-enhance-cost>{view.costText}</dd></div>
      <div><dt>{L.fxLabel}</dt><dd data-enhance-fx>{view.fxText}</dd></div>
    </dl>
    {#if view.ovrText}<p class="ovr" data-enhance-ovr>{view.ovrText}</p>{/if}
    {#if view.tierText}<p class="muted fs-sm" data-enhance-tier>{view.tierText}</p>{/if}
    {#if view.failText}<p class="muted fs-sm" data-enhance-fail-note>{view.failText}</p>{/if}
    {#if result && enhanceTitleText(result.titles)}<p class="result good" role="status" data-enhance-title>{enhanceTitleText(result.titles)}</p>{/if}
    {#if error}<p class="note" role="alert" data-enhance-error>{error}</p>{/if}
    {#if view.block}<p class="note" data-enhance-block>{view.block}</p>{/if}
    <button class="btn btn-primary btn-block" disabled={busy || !view.body} onclick={go} data-act="enhance-go">{busy ? L.going : L.go}</button>
    <p class="muted fs-xs foot">
      {L.balance} {fundsText(info.balance)}<br />
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
  .stage{position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:center;gap:4px;margin:4px 0 12px;padding:12px;border-radius:12px;background:var(--surface-2);text-align:center;}
  .who{overflow-wrap:anywhere;}
  .lv{font-family:var(--display);font-weight:700;font-size:2.4rem;line-height:1.1;color:var(--accent-text);font-variant-numeric:tabular-nums;}
  .gauge{width:70%;height:4px;border-radius:2px;background:var(--line);overflow:hidden;}
  .gauge i{display:block;height:100%;background:var(--accent);transform-origin:left;animation:enh-charge ease-out forwards;}
  .charging .lv{animation:enh-swell 650ms ease-out forwards;}
  .stage[data-fx='success'] .lv{animation:enh-pop 460ms cubic-bezier(.3,1.7,.5,1);}
  .stage[data-fx='down'] .lv{color:var(--bad);}
  .stage[data-fx='down']{animation:enh-shake 360ms linear;}
  .stage[data-fx='keep']{animation:enh-nudge 240ms linear;}
  .flash{position:absolute;inset:0;pointer-events:none;background:var(--line);opacity:0;animation:enh-flash 520ms ease-out;}
  .stage[data-fx='success'] .flash{background:var(--accent);}
  .stage[data-fx='down'] .flash{background:var(--bad);}
  .burst{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;}
  .burst>*{grid-area:1/1;}
  .ring{width:60px;height:60px;border:3px solid var(--accent);border-radius:50%;opacity:0;animation:enh-ring 620ms ease-out;}
  .burst i{width:6px;height:6px;border-radius:50%;background:var(--accent);opacity:0;animation:enh-spark 620ms ease-out;}
  @keyframes enh-charge{from{transform:scaleX(0);}to{transform:scaleX(1);}}
  @keyframes enh-swell{to{transform:scale(1.12);}}
  @keyframes enh-pop{from{transform:scale(.4);}to{transform:scale(1);}}
  @keyframes enh-shake{0%,100%{transform:none;}20%{transform:translateX(-8px);}45%{transform:translateX(6px);}70%{transform:translateX(-3px);}}
  @keyframes enh-nudge{0%,100%{transform:none;}35%{transform:translateX(-3px);}70%{transform:translateX(3px);}}
  @keyframes enh-flash{from{opacity:.4;}to{opacity:0;}}
  @keyframes enh-ring{from{opacity:.9;transform:scale(.5);}to{opacity:0;transform:scale(2.6);}}
  @keyframes enh-spark{from{opacity:1;transform:rotate(var(--a)) translateY(-22px);}to{opacity:0;transform:rotate(var(--a)) translateY(-78px);}}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 10px;}
  .grid div{border:1px solid var(--line);border-radius:10px;padding:8px 10px;}
  .grid dt{font-size:.72rem;color:var(--muted);}
  .grid dd{margin:2px 0 0;font-weight:700;font-variant-numeric:tabular-nums;}
  .ovr{margin:0 0 6px;font-weight:600;}
  .note{padding:10px 12px;border-radius:10px;background:var(--surface-2);font-size:13px;line-height:1.6;}
  .result{margin:6px 0 0;min-height:1.5em;line-height:1.5;font-weight:600;}
  .result.good{color:var(--good);}
  .result.bad{color:var(--bad);}
  .foot{margin-top:10px;line-height:1.6;}
</style>
