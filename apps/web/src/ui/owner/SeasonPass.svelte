<script lang="ts">
  // T-11-511 시즌 패스(내 구단 화면 '시즌 패스' 칸으로 연다). 열 때 한 번 패스 상태(1분 메모)를 받는다. 산 패스의 열린 단계
  // 보상을 받고, T-11-591부터 웹 결제가 열린 구단주는 웹에서 이번 시즌 패스를 산다(엑솔라).
  import PopSheet from '../PopSheet.svelte';
  import Skeleton from '../Skeleton.svelte';
  import type { SeasonPassResponse, SeasonPassSeason } from '@offside/contracts';
  import { claimSeasonPassReward, fetchSeasonPass } from '@offside/app-core/api/seasonPass';
  import { needsOwnerLogin } from '@offside/app-core/market';
  import { rewardText } from '@offside/app-core/attendance-view';
  import {
    PASS_RULE,
    PASS_TIER_COUNT,
    passClaimable,
    passNext,
    passTiers,
    passTotalText,
  } from '@offside/app-core/season-pass-view';
  import { seasonPassText as L } from '@offside/app-core/i18n/ko/seasonPass';
  import { hasSessionHint } from '@offside/app-core/api/client';
  import { loadWebPay, startWebPay, webPay } from '../cup/webPay.svelte.js';

  const { onclose }: { onclose: () => void } = $props();

  let pass = $state<SeasonPassResponse | null>(null);
  let failed = $state<'login' | 'error' | null>(null);
  let busy = $state(false);
  let note = $state<{ ok: boolean; text: string } | null>(null);
  let key: string | null = null;

  async function load() {
    failed = null;
    const r = await fetchSeasonPass();
    if (r.ok) pass = r.data;
    else failed = needsOwnerLogin(r.error) ? 'login' : 'error';
  }
  void load();
  if (hasSessionHint()) void loadWebPay();
  // 결제창에서 돌아와 결제가 확인되면 패스 상태를 다시 읽는다.
  let seenPaid = webPay.paid;
  $effect(() => {
    if (webPay.paid !== seenPaid) {
      seenPaid = webPay.paid;
      void load();
    }
  });
  const webPass = $derived(webPay.config?.enabled ? webPay.config.pass : undefined);

  const current = $derived(pass?.seasons[0] ?? null);
  const past = $derived(pass?.seasons.filter((s) => current && s.season < current.season) ?? []);
  const ahead = $derived(pass?.seasons.filter((s) => current && s.season > current.season) ?? []);

  async function claim(s: SeasonPassSeason) {
    if (busy) return;
    busy = true;
    key ??= crypto.randomUUID();
    const r = await claimSeasonPassReward(s.season, key);
    busy = false;
    if (!r.ok) {
      note = { ok: false, text: r.error.retryable ? L.claimFail : r.error.message || L.claimFail };
      return;
    }
    key = null;
    pass = r.data.pass;
    const got = rewardText(r.data.granted);
    note = got ? { ok: true, text: L.got({ reward: got }) } : { ok: false, text: L.nothing };
  }
</script>

{#snippet track(s: SeasonPassSeason)}
  {@const next = passNext(s)}
  <div class="sp-band stack">
    <div class="sp-band-top">
      <b>{L.seasonTitle({ season: s.season })}</b>
      <span class="sp-pill" class:on={s.owned}>{s.owned ? L.owned : L.tierCount({ tier: s.tier, total: PASS_TIER_COUNT })}</span>
    </div>
    <div class="sp-meter" role="img" aria-label={L.tierCount({ tier: s.tier, total: PASS_TIER_COUNT })}>
      <i style:width="{(s.tier / PASS_TIER_COUNT) * 100}%"></i>
    </div>
    <div class="sp-band-top fs-sm">
      <span>{L.progress({ n: s.progress })}</span>
      <span class="sp-soft">{next ? L.next(next) : L.allOpen}</span>
    </div>
  </div>
  <ol class="sp-tiers" data-pass-tiers={s.season}>
    {#each passTiers(s) as t (t.tier)}
      {@const state = t.state === 'claimed' ? L.stateClaimed : t.state === 'open' ? L.stateOpen : L.stateLocked}
      {@const need = t.kind === 'now' ? L.tierNow : t.kind === 'bonus' ? L.tierBonus({ n: t.need }) : L.tierNeed({ n: t.need })}
      <li class="sp-tier {t.state}" aria-label={L.tierLabel({ tier: t.tier, need, reward: t.reward, state })}>
        <b class="sp-num">{t.tier}</b>
        <span class="stack sp-tier-body">
          <span>{t.reward}</span>
          <small class="muted">{need}</small>
        </span>
        <small class="sp-state">{state}</small>
      </li>
    {/each}
  </ol>
  {#if passClaimable(s)}
    <button class="btn btn-primary btn-block" data-act="pass-claim" disabled={busy} onclick={() => void claim(s)}>{busy ? L.claimBusy : L.claim}</button>
  {/if}
{/snippet}

<PopSheet label={L.title} step={pass ? 'pass' : 'load'} {onclose}>
  <div class="stack sp" data-season-pass aria-busy={busy}>
    <div class="sp-head">
      <h2>{L.title}</h2>
      <button class="btn btn-sm" data-act="pass-close" onclick={onclose}>{L.back}</button>
    </div>
    {#if failed === 'login'}
      <p>{L.login}</p>
    {:else if failed}
      <p role="alert">{L.loadFail}</p>
      <button class="btn" onclick={() => void load()}>{L.retry}</button>
    {:else if !pass || !current}
      <Skeleton rows={6} />
    {:else}
      {#if note}<p class="sp-note" class:bad={!note.ok} role="status">{note.text}</p>{/if}
      <p class="fs-sm">{L.lead}</p>
      {@render track(current)}
      {#if !current.owned}
        {#if webPass}
          <button class="btn btn-primary btn-block" data-act="pass-web-buy" disabled={webPay.busy} onclick={() => void startWebPay(webPass.productId, 'pass')}>{L.webBuyBtn({ price: webPass.amount.toLocaleString('ko-KR') })}</button>
          <p class="fs-xs muted">{L.webBuyNote}</p>
        {:else}
          <p class="fs-sm muted" data-pass-web-buy>{pass.onSale ? L.webBuy : L.notOnSale}</p>
        {/if}
      {/if}
      <p class="fs-xs muted">{L.rule(PASS_RULE)} {L.midSeason} {L.once}</p>
      <p class="fs-xs muted">{L.total({ reward: passTotalText() })}</p>
      {#each ahead as s (s.season)}
        <section class="sp-card stack" data-pass-ahead={s.season}>
          <b>{L.aheadTitle({ season: s.season })}</b>
          <span class="fs-sm muted">{L.aheadLead}</span>
        </section>
      {/each}
      {#if past.length}
        <h3 class="sp-sub">{L.pastTitle}</h3>
        <p class="fs-sm muted">{L.pastLead}</p>
        {#each past as s (s.season)}{@render track(s)}{/each}
      {/if}
      <p class="fs-xs muted">{L.useHint}</p>
    {/if}
  </div>
</PopSheet>

<style>
  .sp {gap:12px;padding:4px 16px 20px;}
  .sp-head {display:flex;align-items:center;gap:8px;}
  .sp-head h2 {flex:1;margin:0;font-size:1.1rem;}
  .sp-sub {margin:8px 0 0;font-size:1rem;}
  .sp-band {gap:10px;padding:16px;border-radius:var(--radius-md);background:var(--pitch);color:var(--on-pitch);}
  .sp-band-top {display:flex;justify-content:space-between;align-items:baseline;gap:12px;}
  .sp-soft {opacity:.75;text-align:right;}
  .sp-pill {font-size:12px;font-weight:700;padding:2px 8px;border-radius:6px;border:1px solid var(--chalk);}
  .sp-pill.on {background:var(--pitch-accent);border-color:var(--pitch-accent);color:var(--pitch);}
  .sp-meter {height:8px;border-radius:4px;background:color-mix(in srgb, var(--chalk) 35%, transparent);overflow:hidden;}
  .sp-meter i {display:block;height:100%;background:var(--pitch-accent);}
  .sp-tiers {list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px;}
  .sp-tier {display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:var(--radius-md);border:1px solid var(--line);background:var(--surface);}
  .sp-tier.locked {opacity:.6;}
  .sp-tier.open {border-color:var(--accent);}
  .sp-num {font-family:var(--display);font-size:1.2rem;min-width:24px;text-align:center;}
  .sp-tier-body {flex:1;gap:0;min-width:0;}
  .sp-state {font-weight:700;}
  .sp-tier.claimed .sp-state {color:var(--good);}
  .sp-tier.open .sp-state {color:var(--accent);}
  .sp-card {gap:4px;padding:12px;border-radius:var(--radius-md);background:var(--surface-2);}
  .sp-note {margin:0;padding:10px 12px;border-radius:var(--radius-md);background:var(--surface-2);color:var(--good);}
  .sp-note.bad {color:var(--ink);}
</style>
