<script lang="ts">
  // T-11-834 크리스마스 이벤트 카드(12/19~1/4). 양말 세 개(첫 시즌 · 은퇴 · 구단주 팀)와 모두가 채우는 트리 입구.
  // 기간 안일 때만 Home.svelte가 import()로 부르고(첫 화면 번들 밖), 상태는 app-core api/xmas.ts의 5분 메모 한 번이다.
  // 받기는 로그인한 구단주만 — 로그인 전이면 같은 창에서 로그인 버튼을 보인다. 그리는 값은 app-core xmas-view.ts(앱과 같다).
  import type { XmasEvent, XmasSock } from '@offside/contracts';
  import { claimXmas, fetchXmas } from '@offside/app-core/api/xmas';
  import {
    sockHint,
    sockLabel,
    sockState,
    sockStateLabel,
    treeCountText,
    treePct,
    xmasClaimToast,
    xmasDaysLeft,
    xmasRewardText,
  } from '@offside/app-core/xmas-view';
  import { xmasText as L } from '@offside/app-core/i18n/ko/xmas';
  import LoginButtons from './LoginButtons.svelte';
  import PopSheet from './PopSheet.svelte';
  import { toast } from './helpers.js';
  import { go, goContinue, goNew } from './nav.js';
  import { appState } from './state.svelte.js';
  import { playSfx } from './sfx.js';

  const { preview = false }: { preview?: boolean } = $props();
  let ev = $state<XmasEvent | null>(null);
  let sheet = $state<'tree' | XmasSock['key'] | null>(null);
  let busy = $state<string | null>(null);
  // 응답을 못 받아 다시 누르면 같은 키로 보내 두 번 받지 않는다. 받기가 끝나면 새 키로 바꾼다.
  const keys: Record<string, string> = {};
  const IMG = { start: '/xmas/sock-small.webp', retire: '/xmas/sock-medium.webp', team: '/xmas/sock-big.webp' };

  $effect(() => {
    void fetchXmas(preview).then((r) => (ev = r));
  });

  const sock = $derived(ev && sheet && sheet !== 'tree' ? ev.socks.find((s) => s.key === sheet) ?? null : null);
  const pct = $derived(ev ? treePct(ev) : 0);

  async function claim(target: string) {
    if (!ev || busy) return;
    busy = target;
    const key = (keys[target] ??= crypto.randomUUID());
    const r = await claimXmas(target, key, preview);
    busy = null;
    if (r.ok) {
      delete keys[target];
      playSfx('reward');
      ev = r.data.event;
      toast(xmasClaimToast(target, r.data.granted, r.data.title));
      if (sheet && sheet !== 'tree') sheet = null;
    } else if (r.error.reason === 'XMAS_CLOSED') {
      delete keys[target];
      ev = null;
      toast(r.error.message);
    } else if (r.error.reason === 'XMAS_CLAIMED' || r.error.reason === 'XMAS_NOT_READY') {
      delete keys[target];
      ev = await fetchXmas(preview);
      if (r.error.reason === 'XMAS_NOT_READY') toast(r.error.message);
    } else toast(L.fail);
  }

  function tapSock(s: XmasSock) {
    if (!ev) return;
    if (sockState(ev, s) === 'ready') void claim(`sock:${s.key}`);
    else sheet = s.key;
  }

  function goDo(key: XmasSock['key']) {
    sheet = null;
    if (key === 'team') go('owner');
    else if (appState.G && !appState.G.retired) goContinue();
    else goNew();
  }
</script>

{#if ev}
  <section class="card xmas" data-home-xmas data-owner={ev.owner ? '1' : '0'}>
    <div class="xm-head">
      <div class="xm-title">
        <small class="eyebrow xm-eyebrow">{L.until}</small>
        <b>{L.title}</b>
        <span class="fs-sm xm-sub">{L.sub}</span>
      </div>
      <span class="xm-dday num">{L.dday({ n: xmasDaysLeft() })}</span>
    </div>
    <div class="xm-socks">
      {#each ev.socks as s (s.key)}
        {@const st = sockState(ev, s)}
        <button
          type="button"
          class="xm-sock st-{st}"
          data-xmas-sock={s.key}
          data-state={st}
          disabled={busy === `sock:${s.key}`}
          aria-label={`${sockLabel(s.key)}, ${xmasRewardText(s.reward)}, ${sockStateLabel(st)}`}
          onclick={() => tapSock(s)}
        >
          <img src={IMG[s.key]} alt="" width="64" height="64" loading="lazy" decoding="async" />
          <span class="xm-sl fs-xs">{sockLabel(s.key)}</span>
          <span class="xm-chip fs-xs">{st === 'claimed' ? '✓ ' : ''}{sockStateLabel(st)}</span>
        </button>
      {/each}
    </div>
    <button type="button" class="xm-tree" data-act="xmas-tree" onclick={() => (sheet = 'tree')}>
      <span class="xm-tl fs-sm"><b>{L.treeTitle}</b><span class="num xm-progress">{L.treeEntry({ pct })}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg></span></span>
      <span class="xm-bar" aria-hidden="true"><span style="width:{pct}%"></span></span>
    </button>
  </section>

  {#if sheet === 'tree'}
    <PopSheet label={L.treeTitle} onclose={() => (sheet = null)}>
      <div class="xm-sheet" data-xmas-tree-sheet>
        <h2>{L.treeTitle}</h2>
        <img class="xm-tree-img" src="/xmas/tree.webp" alt="" width="180" height="180" style="filter:saturate({0.35 + (pct / 100) * 0.65}) brightness({0.75 + (pct / 100) * 0.25})" />
        <p class="fs-sm">{ev.tree.counting ? L.treeLead : L.treeClosed}</p>
        <div class="xm-bar big" aria-hidden="true"><span style="width:{pct}%"></span></div>
        <p class="fs-sm num xm-count"><span>{treeCountText(ev)}</span><span class="muted">{L.treeMine({ n: ev.tree.mine })}</span></p>
        <ol class="xm-steps">
          {#each ev.tree.steps as step, i (step.pct)}
            {@const target = `tree:${i + 1}`}
            <li class:reached={step.reached} data-xmas-step={i + 1}>
              <b class="num">{step.pct}%</b>
              <span class="fs-sm">{xmasRewardText(step.reward)}</span>
              {#if step.claimed}
                <span class="fs-xs good">✓ {L.stateClaimed}</span>
              {:else if step.reached && ev.owner}
                <button class="btn btn-accent btn-sm" data-act="xmas-tree-claim" disabled={busy === target} onclick={() => claim(target)}>{L.stateReady}</button>
              {:else}
                <span class="fs-xs muted">{step.reached ? L.stepReached : L.stepLocked}</span>
              {/if}
            </li>
          {/each}
        </ol>
        {#if !ev.owner}
          <p class="fs-sm muted">{L.loginLead}</p>
          <LoginButtons back={{ home: true }} act="xmas-google-login" place="home" />
        {/if}
        <button class="btn btn-block" data-act="xmas-close" onclick={() => (sheet = null)}>{L.close}</button>
      </div>
    </PopSheet>
  {:else if sock}
    {@const st = sockState(ev, sock)}
    <PopSheet label={sockLabel(sock.key)} onclose={() => (sheet = null)}>
      <div class="xm-sheet" data-xmas-sock-sheet={sock.key}>
        <img class="xm-sock-img" src={IMG[sock.key]} alt="" width="96" height="96" />
        <h2>{sockLabel(sock.key)}</h2>
        <p class="fs-sm">{sockHint(sock.key)}</p>
        <p class="fs-sm"><b>{xmasRewardText(sock.reward)}</b></p>
        {#if st === 'login'}
          <p class="fs-sm muted">{L.loginLead}</p>
          <LoginButtons back={{ home: true }} act="xmas-google-login" place="home" />
        {:else if st === 'todo'}
          {#if !ev.owner}<p class="fs-sm muted">{L.loginLead}</p>{/if}
          <button class="btn btn-accent btn-block" data-act="xmas-go" onclick={() => goDo(sock.key)}>{sock.key === 'team' ? L.goTeam : appState.G && !appState.G.retired ? L.goCareer : L.goStart}</button>
        {:else if st === 'claimed'}
          <p class="fs-sm good">✓ {L.stateClaimed}</p>
        {/if}
        <button class="btn btn-block" data-act="xmas-close" onclick={() => (sheet = null)}>{L.close}</button>
      </div>
    </PopSheet>
  {/if}
{/if}

<style>
  .xmas {
    --xm-red: #c8654f;
    --xm-green: #2f6b4f;
    display: flex;
    flex-direction: column;
    gap: 12px;
    background:
      radial-gradient(120% 90% at 100% 0%, color-mix(in srgb, var(--xm-red) 22%, transparent), transparent 60%),
      linear-gradient(160deg, color-mix(in srgb, var(--xm-green) 20%, var(--surface)), var(--surface));
    border: 1px solid color-mix(in srgb, var(--xm-red) 30%, var(--line));
  }
  .xm-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
  }
  .xm-title {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .xm-eyebrow {
    color: var(--xm-red);
  }
  .xm-sub {
    color: var(--muted);
  }
  .xm-dday {
    flex: none;
    padding: 4px 10px;
    border-radius: 999px;
    font-weight: 700;
    font-size: var(--fs-caption);
    color: #fff;
    background: var(--xm-red);
  }
  .xm-socks {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .xm-sock {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 10px 4px 8px;
    border-radius: 14px;
    border: 1px solid var(--line);
    background: color-mix(in srgb, var(--surface) 80%, transparent);
    font: inherit;
    color: inherit;
    cursor: pointer;
  }
  .xm-sock img {
    width: 56px;
    height: 56px;
    object-fit: contain;
  }
  .xm-sock.st-todo img {
    opacity: 0.55;
    filter: saturate(0.6);
  }
  .xm-sock.st-ready {
    border-color: var(--xm-red);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--xm-red) 25%, transparent);
  }
  .xm-sl {
    font-weight: 700;
    text-align: center;
    line-height: 1.25;
  }
  .xm-chip {
    padding: 1px 8px;
    border-radius: 999px;
    color: var(--muted);
    background: color-mix(in srgb, var(--muted) 12%, transparent);
  }
  .st-ready .xm-chip {
    color: #fff;
    background: var(--xm-red);
    font-weight: 700;
  }
  .st-login .xm-chip {
    color: var(--accent-text);
    background: color-mix(in srgb, var(--accent) 14%, transparent);
  }
  .st-claimed .xm-chip {
    color: var(--accent-text);
  }
  .xm-tree {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }
  .xm-tl {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }
  .xm-progress { display: inline-flex; align-items: center; gap: 4px; }
  .xm-progress svg { flex: none; width: 16px; height: 16px; fill: none; stroke: var(--muted); stroke-width: 2; }
  .xm-bar {
    display: block;
    height: 8px;
    border-radius: 999px;
    overflow: hidden;
    background: color-mix(in srgb, var(--muted) 18%, transparent);
  }
  .xm-bar > span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--xm-green, #2f6b4f), #d7af54);
  }
  .xm-bar.big {
    height: 12px;
  }
  .xm-sheet {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .xm-sheet h2 {
    margin: 0;
    font-size: var(--fs-title3);
  }
  .xm-tree-img,
  .xm-sock-img {
    align-self: center;
    object-fit: contain;
  }
  .xm-count {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
    margin: 0;
  }
  .xm-steps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .xm-steps li {
    display: grid;
    grid-template-columns: 48px 1fr auto;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 12px;
    border: 1px solid var(--line);
  }
  .xm-steps li.reached {
    border-color: color-mix(in srgb, #d7af54 60%, var(--line));
  }
</style>
