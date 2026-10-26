<script lang="ts">
  // T-11-374 카드 바치기 과제(내 구단 화면 '카드 과제' 칸으로 연다). 오늘의 과제 목록은 코드 묶음이라 부르지 않고, 열 때 내 팀
  // (선수 목록 · 선발, 1분 메모)과 내 낸 횟수만 받는다. 과제를 고르면 선수를 고르고 확인한 뒤 낸다. 세 개를 모두 내면 보상.
  // T-11-499 위 진행 띠에 오늘 낸 과제와 보상을 모으고, 과제마다 가치 낮은 선수로 추천 조합을 채워 '이 N명 내기' 한 번에 낸다.
  // 고르기 화면은 낼 수 있는 선수만 가치 낮은 순으로 보이고 낼 수 없는 선수는 접는다. 낸 뒤에는 목록에 머문다.
  import PopSheet from '../PopSheet.svelte';
  import type { TeamPlayer, OwnerTeamResponse } from '@offside/app-core/api/team';
  import { fetchOwnerTeam } from '@offside/app-core/api/team';
  import { claimExchange, fetchExchangeMe } from '@offside/app-core/api/exchange';
  import type { ExchangeMeResponse } from '@offside/contracts';
  import {
    autoFill,
    canFinishAll,
    endsText,
    exchangeCardOf,
    exchangeChecklist,
    exchangeFitCount,
    exchangeLock,
    exchangeMet,
    exchangeName,
    exchangeRecommend,
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
  let reward = $state<ExchangeMeResponse['reward']>([]);
  let failed = $state(false);
  let def = $state<ExchangeDef | null>(null);
  let picked = $state<string[]>([]);
  // 확인 화면. 취소하면 연 곳(목록 · 고르기)으로 돌아간다.
  let confirm = $state<'list' | 'pick' | null>(null);
  let howTo = $state(false);
  let showLocked = $state(false);
  let busy = $state(false);
  let error = $state<string | null>(null);
  let toast = $state<string | null>(null);
  let done = $state<{ reward: string | null; titles: string[] } | null>(null);

  const now = Date.now();
  const defs = exchangesAt(new Date(now).toISOString());
  const lineup = $derived(team ? lineupOf(team) : new Set<string>());
  const players = $derived(team?.players ?? []);
  const chosen = $derived(players.filter((p) => picked.includes(p.careerId)));
  const checks = $derived(def ? exchangeChecklist(def.rule, chosen.map(exchangeCardOf)) : []);
  const ready = $derived(!!def && exchangeMet(def.rule, chosen.map(exchangeCardOf)));
  const used = (d: ExchangeDef) => (claims[d.id] ?? 0) > 0;
  const doneCount = $derived(defs.filter(used).length);
  // 영입 · 잠김 · 판매 중 · 선발을 뺀, 오늘 낼 수 있는 선수. 남은 과제를 모두 채울 수 있는지 미리 알린다.
  const free = $derived(players.filter((p) => !exchangeLock(p, lineup, { count: 0 })).map(exchangeCardOf));
  const feasible = $derived(canFinishAll(defs.filter((d) => !used(d)), free));
  const recs = $derived(exchangeRecommend(defs.filter((d) => !used(d)), free));
  const byValue = (a: TeamPlayer, b: TeamPlayer) => (a.cardValue ?? 0) - (b.cardValue ?? 0);
  const open = $derived(def ? players.filter((p) => !exchangeLock(p, lineup, def!.rule)).sort(byValue) : []);
  const shut = $derived(def ? players.filter((p) => !!exchangeLock(p, lineup, def!.rule)) : []);
  const value = (ps: readonly { cardValue?: number | null | undefined }[]) => fmtValue(ps.reduce((a, p) => a + (p.cardValue ?? 0), 0));
  const nameOf = (p: TeamPlayer) => marketName(p, local);
  const nameById = (id: string) => {
    const p = players.find((x) => x.careerId === id);
    return p ? nameOf(p) : '';
  };

  async function load() {
    failed = false;
    const [t, me] = await Promise.all([fetchOwnerTeam(), fetchExchangeMe()]);
    if (!t.ok || !me.ok) {
      failed = true;
      return;
    }
    team = t.data;
    claims = me.data.claims;
    reward = me.data.reward;
  }
  $effect(() => {
    void load();
  });

  function pickTask(d: ExchangeDef, ids: string[] = []) {
    def = d;
    picked = ids;
    confirm = null;
    showLocked = false;
    error = null;
    toast = null;
  }
  function quick(d: ExchangeDef) {
    pickTask(d, (recs.get(d.id) ?? []).map((c) => c.careerId));
    confirm = 'list';
  }
  function cancel() {
    if (confirm === 'list') def = null;
    confirm = null;
  }
  function toggle(p: TeamPlayer) {
    picked = picked.includes(p.careerId)
      ? picked.filter((id) => id !== p.careerId)
      : picked.length < (def?.rule.count ?? 0)
        ? [...picked, p.careerId]
        : picked;
  }
  function fill() {
    if (!def) return;
    const got = autoFill(def.rule, open.map(exchangeCardOf));
    error = got ? null : L.autoFillNone;
    picked = got ? got.map((c) => c.careerId) : picked;
  }
  async function submit() {
    if (!def || !ready) return;
    busy = true;
    error = null;
    const r = await claimExchange(def.id, picked);
    busy = false;
    if (!r.ok) {
      // 고르기 화면으로 돌아가 이유와 고른 선수를 같이 보여 준다.
      error = r.error.message || L.claimFail;
      confirm = null;
      return;
    }
    const name = exchangeName(def.key);
    if (r.data.rewards.length || r.data.titles.length)
      done = { reward: r.data.rewards.length ? rewardText(r.data.rewards) : null, titles: r.data.titles };
    else toast = L.doneToast({ name, left: Math.max(0, defs.length - r.data.done) });
    def = null;
    picked = [];
    confirm = null;
    void load();
  }
</script>

{#snippet check()}<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M5 12l5 5L19 8" /></svg>{/snippet}

<PopSheet label={L.title} step={confirm ? 'confirm' : (def?.id ?? (done ? 'done' : 'list'))} {onclose}>
  <div class="stack xc" data-card-exchange aria-busy={busy}>
    <div class="xc-head">
      {#if def && !confirm}<button class="btn btn-sm xc-icon" data-act="exchange-back" aria-label={L.back} onclick={() => (def = null)}>‹</button>{/if}
      <h2>{def && !confirm ? exchangeName(def.key) : L.title}</h2>
      {#if def && !confirm}<span class="xc-tier t-{def.tier}">{tierLabel(def.tier)}</span>
      {:else if !confirm}<button class="btn btn-sm xc-icon" aria-label={L.howTo} aria-expanded={howTo} onclick={() => (howTo = !howTo)}>?</button>{/if}
      <button class="btn btn-sm" data-act="exchange-close" onclick={onclose}>{L.close}</button>
    </div>
    {#if done}
      <section class="xc-done stack" role="status" data-exchange-done>
        <b class="xc-done-title">{L.doneAllTitle}</b>
        {#if done.reward}<span class="xc-done-reward">{L.doneBody({ reward: done.reward })}</span>{/if}
        {#each done.titles as t (t)}<span class="good">{L.doneTitleEarned({ name: titleLabel(t) ?? t })}</span>{/each}
        <span class="fs-sm xc-soft">{L.todayDone}</span>
        <button class="btn btn-primary" onclick={() => (done = null)}>{L.ok}</button>
      </section>
    {:else if failed}
      <p role="alert">{L.loadFail}</p>
      <button class="btn" onclick={() => void load()}>{L.retry}</button>
    {:else if !team}
      <p role="status">{L.loading}</p>
    {:else if confirm && def}
      <section class="stack xc-confirm" data-exchange-confirm>
        <h3>{L.confirmTitle({ n: chosen.length })}</h3>
        <ul class="xc-mini">
          {#each chosen as p (p.careerId)}<li><b class="xc-num">{p.peak}</b><span>{nameOf(p)}</span><small class="muted">{tn(POS_LABEL[p.pos])}</small></li>{/each}
        </ul>
        <p class="fs-sm">{L.confirmGone}</p>
        <p class="fs-sm muted">{L.confirmFunds({ value: value(chosen) })}</p>
        <div class="xc-step">
          <b class="xc-num">{doneCount}/{defs.length}</b><span aria-hidden="true">→</span><b class="xc-num xc-gold">{doneCount + 1}/{defs.length}</b>
          <small>{doneCount + 1 >= defs.length ? L.confirmLast : L.confirmMore({ left: defs.length - doneCount - 1 })}</small>
        </div>
        {#if error}<p role="alert" class="xc-err">{error}</p>{/if}
        <div class="xc-actions">
          <button class="btn" disabled={busy} onclick={cancel}>{L.cancel}</button>
          <button class="btn xc-danger" data-act="exchange-confirm" disabled={busy} onclick={() => void submit()}>{L.confirmOk({ n: chosen.length })}</button>
        </div>
      </section>
    {:else if !def}
      {#if howTo}<p class="muted fs-sm" data-exchange-howto>{L.lead}</p>{/if}
      <section class="xc-band stack" data-exchange-today>
        <div class="xc-band-top"><span class="eyebrow">{L.todayTitle}</span><span class="fs-xs">{endsText(defs[0]!, now)}</span></div>
        <ol class="xc-track" aria-label={L.trackAria({ done: doneCount, total: defs.length })}>
          {#each defs as d, i (d.id)}<li class:on={used(d)}>{#if used(d)}{@render check()}{:else}{i + 1}{/if}</li>{/each}
          <li class="xc-chest" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="9" width="18" height="12" rx="2" /><path d="M3 13h18M12 9v12M7.5 9C6 9 5 8 5 6.5S6.5 4 8 5l4 4 4-4c1.5-1 3 0 3 1.5S18 9 16.5 9" /></svg></li>
        </ol>
        <div class="xc-band-foot">
          <span class="stack" style="gap:2px"><b class="xc-num xc-big">{doneCount}<small>{` / ${defs.length}`}</small></b><small class="xc-soft">{L.todayCount}</small></span>
          <span class="stack xc-reward" style="gap:2px"><small class="xc-soft">{L.rewardAll}</small><b>{rewardText(reward)}</b></span>
        </div>
        {#if doneCount === defs.length}<span class="fs-sm">{L.todayDone}</span>
        {:else if !feasible}<span class="fs-sm xc-warn" data-exchange-cant>{L.cantFinish}</span>{/if}
      </section>
      {#if toast}<p class="xc-toast fs-sm" role="status" data-exchange-toast>{@render check()}{toast}</p>{/if}
      {#each defs as d (d.id)}
        {@const rec = recs.get(d.id)}
        {#if used(d)}
          <section class="xc-def xc-used" data-exchange={d.tier} data-used>
            <div class="xc-def-top"><span class="xc-tier t-{d.tier}">{tierLabel(d.tier)}</span><b>{exchangeName(d.key)}</b><span class="good fs-sm xc-done-tag">{@render check()}{L.taskDone}</span></div>
          </section>
        {:else}
          <section class="xc-def" data-exchange={d.tier}>
            <div class="xc-def-top"><span class="xc-tier t-{d.tier}">{tierLabel(d.tier)}</span><b>{exchangeName(d.key)}</b></div>
            <div class="xc-chips">{#each exchangeChecklist(d.rule, []) as c (c.condition)}<span class="xc-chip">{c.text}</span>{/each}</div>
            {#if rec}
              <ul class="xc-rec" data-exchange-rec>
                {#each rec as c (c.careerId)}<li><b class="xc-num">{c.peak}</b>{nameById(c.careerId)}</li>{/each}
              </ul>
              <small class="muted">{L.recommendNote({ value: value(rec) })}</small>
              <div class="xc-rec-act">
                <button class="btn" data-act="exchange-change" onclick={() => pickTask(d, rec.map((c) => c.careerId))}>{L.change}</button>
                <button class="btn btn-primary" data-act="exchange-quick" disabled={busy} onclick={() => quick(d)}>{L.submitThese({ n: rec.length })}</button>
              </div>
            {:else}
              <span class="fs-sm xc-err" data-exchange-short>{L.cantTask} · {L.fitCount({ n: exchangeFitCount(d.rule, free) })}</span>
              <button class="btn" data-act="exchange-open" onclick={() => pickTask(d)}>{L.pick}</button>
            {/if}
          </section>
        {/if}
      {/each}
    {:else}
      <ul class="xc-chips" data-exchange-checks>
        {#each checks as c (c.condition)}<li class="xc-chip" class:met={c.met}>{#if c.met}{@render check()}{/if}{c.text}</li>{/each}
      </ul>
      <div class="xc-tools">
        <span class="eyebrow">{L.canList({ n: open.length })}</span>
        <button class="btn btn-sm xc-link" data-act="exchange-fill" disabled={busy} onclick={fill}>{L.autoFill}</button>
      </div>
      {#if error}<p role="alert" class="xc-err">{error}</p>{/if}
      <div class="xc-list">
        {#each open as p (p.careerId)}
          <label class="xc-row" data-exchange-player={p.careerId}>
            <input type="checkbox" checked={picked.includes(p.careerId)} disabled={busy} onchange={() => toggle(p)} />
            <span class="stack" style="gap:2px;min-width:0">
              <b>{nameOf(p)}</b>
              <small class="muted">{L.cardLine({ pos: tn(POS_LABEL[p.pos]), peak: p.peak })}</small>
            </span>
            {#if p.cardValue}<span class="xc-num">{fmtValue(p.cardValue)}</span>{/if}
          </label>
        {:else}<p class="empty">{L.noCards}</p>{/each}
        {#if shut.length}
          <button class="xc-more" aria-expanded={showLocked} data-act="exchange-locked" onclick={() => (showLocked = !showLocked)}>
            <span>{L.lockedList({ n: shut.length })}</span><span aria-hidden="true">{showLocked ? '▴' : '▾'}</span>
          </button>
          {#if showLocked}
            {#each shut as p (p.careerId)}
              <div class="xc-row off" data-exchange-player={p.careerId}>
                <input type="checkbox" disabled aria-label={nameOf(p)} />
                <span class="stack" style="gap:2px;min-width:0">
                  <b>{nameOf(p)}</b>
                  <small class="muted">{L.cardLine({ pos: tn(POS_LABEL[p.pos]), peak: p.peak })}</small>
                </span>
                <small class="muted">{exchangeLock(p, lineup, def.rule)}</small>
              </div>
            {/each}
          {/if}
        {/if}
      </div>
      <section class="stack xc-dock">
        <div class="xc-dock-line fs-sm"><b data-exchange-picked>{L.picked({ n: picked.length, need: def.rule.count })}</b><span class="muted">{L.lostValue({ value: value(chosen) })}</span></div>
        <button class="btn btn-primary btn-block" data-act="exchange-submit" disabled={!ready || busy} onclick={() => (confirm = 'pick')}>{L.submitN({ n: def.rule.count })}</button>
      </section>
    {/if}
  </div>
</PopSheet>

<style>
  .xc {gap:12px;padding:4px 16px 20px;}
  .xc-head {display:flex;align-items:center;gap:8px;}
  .xc-head h2 {flex:1;margin:0;font-size:1.1rem;}
  .xc-icon {min-width:44px;font-weight:700;}
  .xc-num {font-family:var(--display);font-weight:700;}
  .xc-tier {display:inline-flex;align-items:center;min-height:22px;padding:0 8px;border-radius:6px;font-size:12px;font-weight:700;flex:none;background:var(--surface-2);}
  .t-easy {color:var(--good);}
  .t-normal {color:var(--ink);}
  .t-hard {color:var(--warn);}
  .xc-band {gap:12px;padding:16px;border-radius:var(--radius-md);background:var(--pitch);color:var(--on-pitch);}
  .xc-band-top,.xc-band-foot {display:flex;justify-content:space-between;align-items:baseline;gap:12px;}
  .xc-band-foot {align-items:flex-end;}
  .xc-band .eyebrow,.xc-soft {color:var(--on-pitch);opacity:.75;}
  /* 동그라미 사이 선은 목록 배경 한 줄로 그리고, 동그라미가 띠 색으로 덮는다. */
  .xc-track {list-style:none;margin:0;padding:0;display:flex;align-items:center;justify-content:space-between;background:linear-gradient(var(--chalk),var(--chalk)) center/100% 2px no-repeat;}
  .xc-track li {width:30px;height:30px;border-radius:50%;border:2px solid var(--chalk);box-sizing:border-box;display:flex;align-items:center;justify-content:center;font-family:var(--display);font-weight:700;flex:none;background:var(--pitch);}
  .xc-track li.on {background:var(--pitch-accent);border-color:var(--pitch-accent);color:var(--pitch);}
  .xc-track .xc-chest {width:44px;height:44px;border-radius:12px;border:1px dashed var(--pitch-accent);color:var(--pitch-accent);}
  .xc-big {font-size:1.9rem;line-height:1;}
  .xc-big small {font-size:1.2rem;opacity:.75;}
  .xc-reward {text-align:right;}
  .xc-reward b {color:var(--pitch-accent);}
  .xc-warn {color:var(--pitch-accent);}
  .xc-toast {display:flex;align-items:center;gap:8px;margin:0;padding:10px 12px;border-radius:var(--radius-md);background:var(--surface-2);color:var(--good);}
  .xc-def {display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:var(--radius-md);border:1px solid var(--line);background:var(--surface);}
  .xc-used {opacity:.65;}
  .xc-def-top {display:flex;align-items:center;gap:8px;}
  .xc-def-top b {flex:1;}
  .xc-done-tag {display:inline-flex;align-items:center;gap:4px;}
  .xc-chips {list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px;}
  .xc-chip {display:inline-flex;align-items:center;gap:4px;min-height:26px;padding:0 9px;border-radius:999px;border:1px solid var(--line);background:var(--surface-2);font-size:12px;color:var(--muted);}
  .xc-chip.met {color:var(--good);border-color:var(--good);}
  .xc-rec {list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px;}
  .xc-rec li {display:inline-flex;align-items:center;gap:6px;min-height:30px;padding:0 10px 0 4px;border-radius:999px;border:1px solid var(--line);background:var(--surface-2);font-size:13px;}
  .xc-rec .xc-num {width:24px;height:24px;border-radius:50%;background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:13px;color:var(--accent-text);}
  .xc-rec-act {display:grid;grid-template-columns:auto 1fr;gap:8px;}
  .xc-rec-act button {min-height:44px;}
  .xc-tools {display:flex;align-items:center;justify-content:space-between;gap:8px;}
  .xc-link {background:transparent;border-color:transparent;color:var(--accent-text);padding:0;}
  .xc-list {display:flex;flex-direction:column;}
  .xc-row {display:flex;align-items:center;gap:10px;border-top:1px solid var(--line);padding:10px 0;min-height:44px;cursor:pointer;}
  .xc-row.off {opacity:.5;cursor:default;}
  .xc-row input {width:22px;height:22px;flex:none;accent-color:var(--good);}
  .xc-row .stack {flex:1;}
  .xc-more {display:flex;justify-content:space-between;align-items:center;min-height:44px;border:0;border-top:1px solid var(--line);background:transparent;color:var(--muted);font:inherit;font-size:14px;padding:0;cursor:pointer;}
  .xc-dock {position:sticky;bottom:0;gap:8px;padding:12px;border-radius:var(--radius-md);background:var(--surface-2);}
  .xc-dock-line {display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;}
  .xc-confirm {gap:12px;}
  .xc-confirm h3 {margin:0;font-size:1.15rem;}
  .xc-confirm p {margin:0;}
  .xc-mini {list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px;}
  .xc-mini li {display:flex;flex-direction:column;gap:2px;padding:10px;border-radius:12px;border:1px solid var(--line);background:var(--surface-2);min-width:0;}
  .xc-mini .xc-num {font-size:1.2rem;color:var(--accent-text);}
  .xc-mini span {font-weight:700;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .xc-step {display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:var(--pitch);color:var(--on-pitch);}
  .xc-step .xc-num {font-size:1.2rem;}
  .xc-step small {flex:1;text-align:right;opacity:.85;}
  .xc-gold {color:var(--pitch-accent);}
  .xc-actions {display:flex;gap:8px;}
  .xc-actions button {flex:1;min-height:44px;}
  .xc-danger {color:var(--bad);border-color:var(--bad);}
  .xc-err {color:var(--bad);}
  .xc-done {gap:10px;padding:18px 16px;border-radius:var(--radius-md);background:var(--pitch);color:var(--on-pitch);}
  .xc-done-title {font-size:1.15rem;}
  .xc-done-reward {color:var(--pitch-accent);font-weight:700;}
</style>
