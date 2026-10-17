<script lang="ts">
  // T-11-374 카드 바치기 과제(내 구단 화면 '카드 과제' 칸으로 연다). 과제 목록은 코드 묶음이라 부르지 않고, 열 때 내 팀
  // (선수 목록 · 선발, 1분 메모)과 내 낸 횟수만 받는다. 과제를 고르면 선수를 고르고 확인한 뒤 낸다.
  import PopSheet from '../PopSheet.svelte';
  import type { TeamPlayer, OwnerTeamResponse } from '@offside/app-core/api/team';
  import { fetchOwnerTeam } from '@offside/app-core/api/team';
  import { claimExchange, fetchExchangeMe } from '@offside/app-core/api/exchange';
  import {
    autoFill,
    claimsText,
    endsText,
    exchangeCardOf,
    exchangeChecklist,
    exchangeLock,
    exchangeMet,
    exchangeName,
    exchangesAt,
    rewardText,
    tierLabel,
    type ExchangeDef,
  } from '@offside/app-core/exchange';
  import { lineupOf } from '@offside/app-core/market';
  import { marketName } from '@offside/app-core/market';
  import { fmtValue } from '@offside/contracts/market-value';
  import { titleLabel } from '@offside/app-core/ownerTitle';
  import { POS_LABEL } from '@offside/game/pos-label';
  import { tn } from '@offside/game/i18n/names';
  import { localCareerNames } from '@offside/game/hof-store';
  import { exchangeText as L } from '@offside/app-core/i18n/ko/exchange';

  const { onclose }: { onclose: () => void } = $props();
  const local = localCareerNames();

  let team = $state<OwnerTeamResponse | null>(null);
  let claims = $state<Record<string, number>>({});
  let failed = $state(false);
  let def = $state<ExchangeDef | null>(null);
  let picked = $state<string[]>([]);
  let confirm = $state(false);
  let busy = $state(false);
  let error = $state<string | null>(null);
  let done = $state<{ reward: string; titles: string[] } | null>(null);

  const now = Date.now();
  const defs = $derived(team ? exchangesAt(new Date(now).toISOString(), team.current ?? null) : []);
  const lineup = $derived(team ? lineupOf(team) : new Set<string>());
  const players = $derived(team?.players ?? []);
  const chosen = $derived(players.filter((p) => picked.includes(p.careerId)));
  const checks = $derived(def ? exchangeChecklist(def.rule, chosen.map(exchangeCardOf)) : []);
  const ready = $derived(!!def && exchangeMet(def.rule, chosen.map(exchangeCardOf)));
  const used = (d: ExchangeDef) => claims[d.id] ?? 0;
  const nameOf = (p: TeamPlayer) => marketName(p, local);

  async function load() {
    failed = false;
    const [t, me] = await Promise.all([fetchOwnerTeam(), fetchExchangeMe()]);
    if (!t.ok || !me.ok) {
      failed = true;
      return;
    }
    team = t.data;
    claims = me.data.claims;
  }
  $effect(() => {
    void load();
  });

  function open(d: ExchangeDef) {
    def = d;
    picked = [];
    confirm = false;
    error = null;
  }
  function toggle(p: TeamPlayer) {
    picked = picked.includes(p.careerId)
      ? picked.filter((id) => id !== p.careerId)
      : picked.length < (def?.rule.count ?? 0)
        ? [...picked, p.careerId]
        : picked;
    confirm = false;
  }
  function fill() {
    if (!def) return;
    const rule = def.rule;
    const pool = players.filter((p) => !exchangeLock(p, lineup, rule)).map(exchangeCardOf);
    const got = autoFill(rule, pool);
    error = got ? null : L.autoFillNone;
    picked = got ? got.map((c) => c.careerId) : picked;
    confirm = false;
  }
  async function submit() {
    if (!def || !ready) return;
    busy = true;
    error = null;
    const r = await claimExchange(def.id, picked);
    busy = false;
    if (!r.ok) {
      error = r.error.message || L.claimFail;
      confirm = false;
      return;
    }
    done = { reward: rewardText(r.data.rewards), titles: r.data.titles };
    def = null;
    picked = [];
    confirm = false;
    void load();
  }
</script>

<PopSheet label={L.title} step={def?.id ?? (done ? 'done' : 'list')} {onclose}>
  <div class="stack xc" data-card-exchange aria-busy={busy}>
    <div class="xc-head">
      {#if def}<button class="btn btn-sm" data-act="exchange-back" onclick={() => (def = null)}>‹ {L.back}</button>{/if}
      <h2>{def ? exchangeName(def.key) : L.title}</h2>
      <button class="btn btn-sm" data-act="exchange-close" onclick={onclose}>{L.close}</button>
    </div>
    {#if done}
      <section class="card stack xc-done" role="status" data-exchange-done>
        <b>{L.doneTitle}</b>
        <span>{L.doneBody({ reward: done.reward })}</span>
        {#each done.titles as t (t)}<span class="good">{L.doneTitleEarned({ name: titleLabel(t) ?? t })}</span>{/each}
        <button class="btn" onclick={() => (done = null)}>{L.ok}</button>
      </section>
    {:else if failed}
      <p role="alert">{L.loadFail}</p>
      <button class="btn" onclick={() => void load()}>{L.retry}</button>
    {:else if !team}
      <p role="status">{L.loading}</p>
    {:else if !def}
      <p class="muted fs-sm">{L.lead}</p>
      {#each defs as d (d.id)}
        {@const left = d.maxClaims - used(d)}
        <button class="card xc-def" data-exchange={d.tier} disabled={left <= 0} onclick={() => open(d)}>
          <span class="xc-tier pill {d.tier === 'hard' || d.tier === 'season' ? 'warn' : 'good'}">{tierLabel(d.tier)}</span>
          <b>{exchangeName(d.key)}</b>
          <span class="muted fs-sm">{exchangeChecklist(d.rule, []).map((c) => c.text).join(' · ')}</span>
          <span class="fs-sm">{L.reward} {rewardText(d.reward)}</span>
          <span class="muted fs-sm">{claimsText(d, used(d))} · {endsText(d, now)}</span>
        </button>
      {/each}
    {:else}
      <ul class="xc-checks" data-exchange-checks>
        {#each checks as c (c.condition)}<li class:met={c.met}><span aria-hidden="true">{c.met ? '✓' : '·'}</span>{c.text}</li>{/each}
      </ul>
      <p class="fs-sm">{L.reward} {rewardText(def.reward)}</p>
      <div class="xc-tools">
        <b data-exchange-picked>{L.picked({ n: picked.length, need: def.rule.count })}</b>
        <button class="btn btn-sm" data-act="exchange-fill" disabled={busy} onclick={fill}>{L.autoFill}</button>
        <button class="btn btn-sm" disabled={busy || !picked.length} onclick={() => { picked = []; confirm = false; }}>{L.clear}</button>
      </div>
      {#if error}<p role="alert" class="xc-err">{error}</p>{/if}
      {#each players as p (p.careerId)}
        {@const lock = exchangeLock(p, lineup, def.rule)}
        <label class="xc-row" class:off={!!lock} data-exchange-player={p.careerId}>
          <input type="checkbox" checked={picked.includes(p.careerId)} disabled={!!lock || busy} onchange={() => toggle(p)} />
          <span class="stack" style="gap:2px;min-width:0">
            <b>{nameOf(p)}</b>
            <small class="muted">{L.cardLine({ pos: tn(POS_LABEL[p.pos]), peak: p.peak })}{p.raised ? '' : ` · ${L.bought}`}</small>
          </span>
          {#if lock}<small class="muted">{lock}</small>{:else if p.cardValue}<small>{fmtValue(p.cardValue)}</small>{/if}
        </label>
      {:else}<p class="empty">{L.noCards}</p>{/each}
      <section class="card stack xc-dock">
        {#if confirm}
          <b>{L.confirmTitle}</b>
          <p class="fs-sm">{L.confirmBody({ n: chosen.length })}</p>
          {#if chosen.some((p) => p.raised)}<p class="fs-sm muted">{L.confirmRaised({ n: chosen.filter((p) => p.raised).length })}</p>{/if}
          <p class="fs-sm muted">{L.confirmValue({ value: fmtValue(chosen.reduce((a, p) => a + (p.cardValue ?? 0), 0)) })}</p>
          <div class="xc-actions">
            <button class="btn" disabled={busy} onclick={() => (confirm = false)}>{L.cancel}</button>
            <button class="btn xc-danger" data-act="exchange-confirm" disabled={busy} onclick={() => void submit()}>{L.confirmOk}</button>
          </div>
        {:else}
          <button class="btn btn-primary btn-block" data-act="exchange-submit" disabled={!ready || busy} onclick={() => (confirm = true)}>{L.submit}</button>
        {/if}
      </section>
    {/if}
  </div>
</PopSheet>

<style>
  .xc {gap:12px;padding:4px 16px 20px;}
  .xc-head {display:flex;align-items:center;gap:8px;}
  .xc-head h2 {flex:1;margin:0;font-size:1.1rem;}
  .xc-def {display:flex;flex-direction:column;align-items:flex-start;gap:4px;text-align:left;width:100%;cursor:pointer;}
  .xc-def:disabled {opacity:.55;cursor:default;}
  .xc-tier {font-size:12px;}
  .xc-checks {list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px;font-size:14px;}
  .xc-checks li {display:flex;gap:8px;color:var(--muted);}
  .xc-checks li.met {color:var(--good);}
  .xc-tools {display:flex;flex-wrap:wrap;align-items:center;gap:8px;}
  .xc-tools b {flex:1 1 100%;}
  .xc-row {display:flex;align-items:center;gap:10px;border-top:1px solid var(--line);padding:10px 0;min-height:44px;cursor:pointer;}
  .xc-row.off {opacity:.5;cursor:default;}
  .xc-row input {width:22px;height:22px;flex:none;accent-color:var(--good);}
  .xc-row .stack {flex:1;}
  .xc-dock {position:sticky;bottom:0;background:var(--surface-2);}
  .xc-actions {display:flex;gap:8px;}
  .xc-actions button {flex:1;min-height:44px;}
  .xc-danger {color:var(--bad);border-color:var(--bad);}
  .xc-err {color:var(--bad);}
</style>
