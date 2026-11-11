<script lang="ts">
  // T-11-373 카드 강화 창(앱 screens/owner/EnhanceSheet.tsx). 열 때 그 카드 상태를 한 번 받고, 시도는 서버가 판정한다. 응답을 받지
  // 못한 시도는 같은 멱등 키로 다시 보내 두 번 판정되지 않는다. 결과는 열린 카드(careerId)에만 돌려준다.
  import type { TeamPlayer } from '@offside/app-core/api/team';
  import { holdAchCheck } from '@offside/app-core/achDirty';
  import { enhanceCard, enhanceCardAuto, fetchEnhanceState, type EnhanceResponse, type EnhanceStateResponse } from '@offside/app-core/api/cardEnhance';
  import { ENHANCE_CHARGE_MS, enhanceAutoBudgets, enhanceAutoExpected, enhanceAutoFinal, enhanceAutoSummary, enhanceAutoTickMs, enhanceAutoTargets, enhanceErrorText, enhanceKeepKey, enhanceResultKind, enhanceResultText, enhanceTitleText, enhanceView, runEnhanceAuto, type EnhanceAutoRun } from '@offside/app-core/cardEnhance';
  import { fmtValue } from '@offside/app-core/format';
  import { fundsText } from '@offside/app-core/funds';
  import { cardEnhanceText as L } from '@offside/app-core/i18n/ko/cardEnhance';
  import { buzz, dur } from '../motion.js';
  import { lockScroll } from '../scrollLock.js';
  import Skeleton from '../Skeleton.svelte';
  import EnhanceFx from './EnhanceFx.svelte';
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

  const view = $derived(info ? enhanceView(info.card, info.rules, info.balance, listed) : null);

  // T-11-679 자동 강화 — 목표 단계 · 쓸 금액을 고르면 서버가 연달아 판정한다. 창을 닫으면 다음 묶음을 보내지 않는다.
  let target = $state(0);
  let budgetPick = $state(0);
  let autoBusy = $state(false);
  let autoStopAsked = $state(false);
  let autoRun = $state<EnhanceAutoRun | null>(null);
  let autoTarget = $state(0);
  // 펼침은 사용자가 정한다(진행이 끝나도 결과가 접히지 않게).
  let autoOpen = $state(false);
  const targets = $derived(info ? enhanceAutoTargets(info.card.level) : []);
  const targetNow = $derived(targets.includes(target) ? target : (targets[0] ?? 0));
  const expected = $derived(info && targetNow ? enhanceAutoExpected(info.card, targetNow, info.rules) : 0);
  const budgets = $derived(info && view?.cost ? enhanceAutoBudgets(expected, info.balance, view.cost) : { list: [], pick: 0 });
  const budgetNow = $derived(budgets.list.some((b) => b.value === budgetPick) ? budgetPick : budgets.pick);
  const autoText = $derived(autoRun && !autoBusy ? enhanceAutoSummary(autoRun, autoTarget) : null);

  // T-11-682 자동 강화 연출: 서버가 묶음으로 판정한 시도를 단계 숫자로 차례로 되감아 보여 주고(성공 · 유지 · 하락마다 숫자가 튄다),
  // 다 끝나면 시작 단계 → 끝 단계를 강화 한 번 결과처럼 전체 화면 연출로 보여 준다. 동작 줄이기면 되감기 없이 결과 문구만 남는다.
  type Kind = ReturnType<typeof enhanceResultKind>;
  const TRAIL = 24;
  let shown = $state<number | null>(null);
  let tick = $state<{ kind: Kind; n: number } | null>(null);
  let trail = $state<Kind[]>([]);
  let rollFrom = 0;
  let closed = false;
  let replay: Promise<void> = Promise.resolve();
  const rolling = $derived(autoBusy && animate);
  const rollPct = $derived(shown === null || autoTarget <= rollFrom ? 0 : Math.max(0, Math.min(1, (shown - rollFrom) / (autoTarget - rollFrom))));
  const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));
  function queueReplay(tries: readonly { success: boolean; from: number; to: number }[]) {
    if (!animate || !tries.length) return;
    const ms = enhanceAutoTickMs(tries.length);
    replay = replay.then(async () => {
      for (const t of tries) {
        if (closed) return;
        const kind = enhanceResultKind(t);
        shown = t.to;
        tick = { kind, n: (tick?.n ?? 0) + 1 };
        trail = [...trail.slice(1 - TRAIL), kind];
        await sleep(ms);
      }
    });
  }

  async function startAuto() {
    if (!info || !view?.body || busy || autoBusy || !budgetNow || !targetNow) return;
    autoBusy = true;
    autoStopAsked = false;
    error = null;
    result = null;
    autoRun = null;
    autoTarget = targetNow;
    const from = info.card.level;
    const started = Date.now();
    rollFrom = from;
    shown = from;
    tick = null;
    trail = [];
    replay = Promise.resolve();
    const run = await runEnhanceAuto({
      start: info.card,
      target: targetNow,
      budget: budgetNow,
      balance: info.balance,
      send: (body, key) => enhanceCardAuto(careerId, body, key),
      newKey: () => crypto.randomUUID(),
      cancelled: () => autoStopAsked,
      onChunk: (r, tries) => {
        autoRun = { ...r };
        queueReplay(tries);
        if (info) info = { ...info, balance: r.balance, card: r.card };
      },
    });
    // 되감기를 다 보여 준 뒤(짧게 끝나도 게이지 한 번 길이는 채운 뒤) 결과를 연다.
    await replay;
    const wait = dur(ENHANCE_CHARGE_MS) - (Date.now() - started);
    if (wait > 0 && run.tries) await sleep(wait);
    autoRun = run;
    autoBusy = false;
    shown = null;
    tick = null;
    if (info) info = { ...info, balance: run.balance, card: run.card };
    if (run.tries) {
      const final = enhanceAutoFinal(run, from);
      result = final;
      if (enhanceResultKind(final) !== 'keep') buzz();
      onresult(careerId, { success: run.card.level > from, from, to: run.card.level, cost: run.spent, balance: run.balance, card: run.card, ...(run.titles.length ? { titles: run.titles } : {}) });
    }
    if (run.stop === 'error') void load();
  }

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
    const unlock = lockScroll();
    return () => {
      autoStopAsked = true;
      closed = true;
      unlock();
    };
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
  <div class="body" data-shake={fx}>
  <header><h2 id="enhance-title">{L.title}</h2><button class="close" aria-label={L.close} onclick={() => dialog.close()}>×</button></header>
  <div class="stage" class:charging={busy && animate} class:rolling data-fx={fx} data-enhance-stage>
    <strong class="who">{name}</strong>
    {#key tick?.n}<span class="lv" data-tick={rolling ? tick?.kind : undefined} data-enhance-level>+{shown ?? info?.card.level ?? player.enhance ?? 0}</span>{/key}
    <span class="gauge" aria-hidden="true">{#if busy && animate}<i style:animation-duration="{ENHANCE_CHARGE_MS}ms"></i>{:else if rolling}<i class="roll" style:transform="scaleX({rollPct})"></i>{/if}</span>
    {#if rolling && trail.length}<span class="trail" aria-hidden="true" data-enhance-auto-trail>{#each trail as k, i (i)}<b data-k={k}></b>{/each}</span>{/if}
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
    <button class="btn btn-primary btn-block" disabled={busy || autoBusy || !view.body} onclick={go} data-act="enhance-go">{busy ? L.going : L.go}</button>
    {#if view.next !== null}
      <details class="auto" data-enhance-auto bind:open={autoOpen}>
        <summary>{L.autoTitle}</summary>
        <div class="auto-body">
          <label>{L.autoTarget}
            <select value={targetNow} disabled={autoBusy} onchange={(e) => (target = Number(e.currentTarget.value))} data-enhance-auto-target>
              {#each targets as t (t)}<option value={t}>+{t}</option>{/each}
            </select>
          </label>
          {#if budgets.list.length}
            <label>{L.autoBudget}
              <select value={budgetNow} disabled={autoBusy} onchange={(e) => (budgetPick = Number(e.currentTarget.value))} data-enhance-auto-budget>
                {#each budgets.list as b (b.value)}<option value={b.value}>{b.label}</option>{/each}
              </select>
            </label>
          {/if}
          <p class="muted fs-xs">{L.autoExpected({ value: fmtValue(expected) })}<br />{L.autoNote}</p>
          {#if autoBusy}
            <p class="auto-status" role="status" data-enhance-auto-progress>{L.autoRunning({ n: autoRun?.tries ?? 0, spent: fmtValue(autoRun?.spent ?? 0) })}</p>
            <button class="btn btn-block" disabled={autoStopAsked} onclick={() => (autoStopAsked = true)} data-act="enhance-auto-stop">{autoStopAsked ? L.autoStopping : L.autoStop}</button>
          {:else}
            <button class="btn btn-primary btn-block" disabled={busy || !view.body || !budgetNow} onclick={startAuto} data-act="enhance-auto-go">{L.autoStart}</button>
          {/if}
          {#if autoText}<p class="auto-status" role="status" data-enhance-auto-result={autoRun?.stop}>{#if autoText.done}{autoText.done}<br />{/if}{autoText.why}</p>{/if}
          {#if !autoBusy && autoRun && enhanceTitleText(autoRun.titles)}<p class="result good" role="status">{enhanceTitleText(autoRun.titles)}</p>{/if}
        </div>
      </details>
    {/if}
    <p class="muted fs-xs foot">
      {L.balance} {fundsText(info.balance)}<br />
      {L.effectNote}
    </p>
  {/if}
  </div>
  {#if animate}<EnhanceFx charging={busy} {result} />{/if}
</dialog>

<style>
  dialog{box-sizing:border-box;width:min(400px,calc(100% - 24px));max-width:100%;max-height:85dvh;overflow:auto;overscroll-behavior:contain;border:1px solid var(--line);border-radius:18px;padding:20px;background:var(--surface);color:var(--ink);}
  dialog::backdrop{background:#0009;}
  header{display:flex;align-items:center;justify-content:space-between;gap:8px;}
  h2{font-size:18px;margin:0;}
  .close{flex:none;width:44px;height:44px;border:0;background:transparent;color:inherit;font-size:28px;cursor:pointer;}
  .stage{position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;margin:4px 0 12px;padding:14px 12px;border-radius:14px;background:var(--surface-2);text-align:center;transition:box-shadow .3s;}
  .stage.charging{box-shadow:0 0 0 2px #ffd35c,0 0 28px #ffb80099;}
  .who{overflow-wrap:anywhere;}
  .lv{font-family:var(--display);font-weight:700;font-size:2.8rem;line-height:1.1;color:var(--accent-text);font-variant-numeric:tabular-nums;}
  .gauge{width:82%;height:10px;border-radius:5px;background:var(--line);overflow:hidden;}
  .gauge i{display:block;height:100%;background:linear-gradient(90deg,#ff8a00,#ffd35c,#fff);box-shadow:0 0 12px #ffd35c;transform-origin:left;animation:enh-charge cubic-bezier(.4,0,.8,.6) forwards;}
  /* 자동 강화는 창을 내려 놓고 누르므로 되감기 동안 단계 칸을 창 위에 붙인다. */
  .stage.rolling{position:sticky;top:-20px;z-index:2;box-shadow:0 0 0 2px #ffd35c,0 0 22px #ffb80077;animation:enh-glow 800ms ease-in-out infinite alternate;}
  .gauge i.roll{animation:none;transition:transform 220ms ease-out;}
  .lv[data-tick='success']{color:#d99a12;animation:enh-tick 260ms ease-out;}
  .lv[data-tick='down']{color:var(--bad);animation:enh-tick-down 260ms ease-out;}
  .lv[data-tick='keep']{animation:enh-tick-keep 180ms linear;}
  .trail{display:flex;gap:3px;justify-content:center;flex-wrap:wrap;max-width:82%;min-height:8px;}
  .trail b{width:8px;height:8px;border-radius:50%;background:var(--muted);opacity:.55;}
  .trail b[data-k='success']{background:#e0a91b;opacity:1;}
  .trail b[data-k='down']{background:var(--bad);opacity:1;}
  .trail b:last-child{transform:scale(1.35);}
  @keyframes enh-glow{from{box-shadow:0 0 0 2px #ffd35c,0 0 12px #ffb80055;}to{box-shadow:0 0 0 2px #ffe08a,0 0 30px #ffb800aa;}}
  @keyframes enh-tick{from{transform:scale(1.28);}to{transform:none;}}
  @keyframes enh-tick-down{from{transform:translateY(6px) scale(.88);}to{transform:none;}}
  @keyframes enh-tick-keep{0%,100%{transform:none;}50%{transform:translateX(-3px);}}
  .charging .lv{animation:enh-tremble 900ms linear forwards;}
  .stage[data-fx='success'] .lv{color:#d99a12;animation:enh-pop 420ms cubic-bezier(.3,1.9,.5,1);}
  .stage[data-fx='down'] .lv{color:var(--bad);animation:enh-pop 300ms ease-out;}
  .body[data-shake='down']{animation:enh-shake 520ms linear;}
  .body[data-shake='keep']{animation:enh-nudge 260ms linear;}
  .body[data-shake='success']{animation:enh-kick 300ms ease-out;}
  @keyframes enh-charge{from{transform:scaleX(0);}to{transform:scaleX(1);}}
  @keyframes enh-tremble{0%{transform:none;}20%{transform:translate(1px,-1px) scale(1.03);}40%{transform:translate(-2px,1px) scale(1.07);}60%{transform:translate(3px,-2px) scale(1.12);}80%{transform:translate(-4px,2px) scale(1.18);}100%{transform:translate(4px,-3px) scale(1.25);}}
  @keyframes enh-pop{from{transform:scale(.4);}to{transform:scale(1);}}
  @keyframes enh-shake{0%,100%{transform:none;}12%{transform:translate(-16px,6px) rotate(-1.5deg);}28%{transform:translate(14px,-5px) rotate(1.2deg);}46%{transform:translate(-10px,4px);}64%{transform:translate(7px,-2px);}82%{transform:translate(-3px,1px);}}
  @keyframes enh-nudge{0%,100%{transform:none;}35%{transform:translateX(-4px);}70%{transform:translateX(4px);}}
  @keyframes enh-kick{0%{transform:scale(.97);}50%{transform:scale(1.02);}100%{transform:none;}}
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
  .auto{margin-top:10px;border:1px solid var(--line);border-radius:12px;padding:0 12px;}
  .auto summary{min-height:44px;display:flex;align-items:center;font-weight:700;cursor:pointer;}
  .auto-body{display:flex;flex-direction:column;gap:10px;padding-bottom:12px;}
  .auto-body label{display:flex;flex-direction:column;gap:4px;font-size:13px;color:var(--muted);}
  .auto-body select{min-height:44px;color:var(--ink);}
  .auto-body p{margin:0;line-height:1.6;}
  .auto-status{font-weight:600;color:var(--ink);}
</style>
